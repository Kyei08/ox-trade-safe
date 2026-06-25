// Tiny IndexedDB-backed store for failed replacement File objects.
// Survives a full page reload (sessionStorage cannot hold File/Blob reliably).

const DB_NAME = "ox-edit-listing";
const STORE = "failedReplaceFiles";
const VERSION = 1;

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

export async function setFailedReplaceFile(key: string, file: File): Promise<void> {
  await withStore("readwrite", (store) => store.put(file, key));
}

export async function getFailedReplaceFile(key: string): Promise<File | undefined> {
  const result = await withStore<File>("readonly", (store) => store.get(key));
  return result instanceof File || result instanceof Blob
    ? (result as File)
    : undefined;
}

export async function deleteFailedReplaceFile(key: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(key));
}
