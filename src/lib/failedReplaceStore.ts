// Tiny IndexedDB-backed store for failed replacement File objects.
// Survives a full page reload (sessionStorage cannot hold File/Blob reliably).
//
// Entries are stored as { file, savedAt } so a cleanup job can prune by age
// or by total size when the store grows beyond a configured budget.

const DB_NAME = "ox-edit-listing";
const STORE = "failedReplaceFiles";
const VERSION = 2;

// Defaults for the cleanup job.
export const FAILED_REPLACE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const FAILED_REPLACE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const CLEANUP_THROTTLE_MS = 6 * 60 * 60 * 1000; // run at most every 6h per tab
const LAST_CLEANUP_KEY = "ox:failedReplaceStore:lastCleanup";

type StoredEntry = {
  file: File | Blob;
  savedAt: number;
  size: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  try {
    const db = await openDb();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      tx.oncomplete = () => {
        db.close();
        resolve(req && "result" in req ? (req.result as T) : undefined);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    return undefined;
  }
}

function isStoredEntry(value: unknown): value is StoredEntry {
  return (
    !!value &&
    typeof value === "object" &&
    "file" in (value as Record<string, unknown>) &&
    "savedAt" in (value as Record<string, unknown>)
  );
}

export async function setFailedReplaceFile(key: string, file: File): Promise<void> {
  const entry: StoredEntry = { file, savedAt: Date.now(), size: file.size };
  await withStore("readwrite", (store) => store.put(entry, key));
}

export async function getFailedReplaceFile(key: string): Promise<File | undefined> {
  const result = (await withStore<unknown>("readonly", (store) =>
    store.get(key) as IDBRequest<unknown>
  )) as unknown;
  if (isStoredEntry(result)) {
    const f = result.file;
    if (f instanceof File) return f;
    if (f instanceof Blob) return new File([f], "replacement", { type: f.type });
    return undefined;
  }
  // Back-compat with v1 entries that stored the raw File/Blob.
  if (result instanceof File) return result;
  if (result instanceof Blob) return new File([result], "replacement", { type: result.type });
  return undefined;
}

export async function deleteFailedReplaceFile(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}

type CleanupOptions = {
  maxAgeMs?: number;
  maxBytes?: number;
};

type CleanupResult = {
  removed: number;
  remaining: number;
  bytesRemaining: number;
};

/**
 * Remove failed-replace entries that are older than `maxAgeMs`, or evict the
 * oldest entries until total bytes are <= `maxBytes`. Safe to call often — it
 * fails open on any storage error.
 */
export async function cleanupFailedReplaceStore(
  options: CleanupOptions = {}
): Promise<CleanupResult> {
  const maxAgeMs = options.maxAgeMs ?? FAILED_REPLACE_MAX_AGE_MS;
  const maxBytes = options.maxBytes ?? FAILED_REPLACE_MAX_BYTES;
  const now = Date.now();
  const result: CleanupResult = { removed: 0, remaining: 0, bytesRemaining: 0 };

  try {
    const db = await openDb();
    const entries: { key: IDBValidKey; savedAt: number; size: number }[] = [];

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        const value = cursor.value as unknown;
        if (isStoredEntry(value)) {
          if (now - value.savedAt > maxAgeMs) {
            cursor.delete();
            result.removed += 1;
          } else {
            entries.push({ key: cursor.key, savedAt: value.savedAt, size: value.size ?? 0 });
          }
        } else {
          // Legacy/unknown entry — drop it so the store stays tidy.
          cursor.delete();
          result.removed += 1;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    let total = entries.reduce((sum, e) => sum + e.size, 0);
    if (total > maxBytes) {
      entries.sort((a, b) => a.savedAt - b.savedAt); // oldest first
      const toEvict: IDBValidKey[] = [];
      for (const e of entries) {
        if (total <= maxBytes) break;
        toEvict.push(e.key);
        total -= e.size;
      }
      if (toEvict.length) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readwrite");
          const store = tx.objectStore(STORE);
          for (const k of toEvict) store.delete(k);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
        result.removed += toEvict.length;
      }
    }

    result.remaining = entries.length - (result.removed - (entries.length === 0 ? 0 : 0));
    result.bytesRemaining = total;
    db.close();
  } catch {
    // ignore — cleanup is best-effort
  }

  return result;
}

/**
 * Throttled wrapper safe to call on app/page mount. Runs cleanup at most once
 * per `CLEANUP_THROTTLE_MS` per browser (tracked via localStorage).
 */
export async function maybeCleanupFailedReplaceStore(
  options: CleanupOptions = {}
): Promise<void> {
  try {
    const last = Number(localStorage.getItem(LAST_CLEANUP_KEY) ?? "0");
    if (Number.isFinite(last) && Date.now() - last < CLEANUP_THROTTLE_MS) return;
    localStorage.setItem(LAST_CLEANUP_KEY, String(Date.now()));
  } catch {
    // localStorage unavailable — still attempt cleanup once.
  }
  await cleanupFailedReplaceStore(options);
}
