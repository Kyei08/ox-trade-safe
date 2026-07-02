import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Upload, X, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { compressImages } from "@/lib/imageCompression";
import {
  setFailedReplaceFile,
  getFailedReplaceFile,
  deleteFailedReplaceFile,
  maybeCleanupFailedReplaceStore,
} from "@/lib/failedReplaceStore";
import { normalizeListingError } from "@/lib/listingValidation";
import { trackEvent } from "@/lib/analytics";
import ConditionSelector, { type SelectedCondition } from "@/components/ConditionSelector";
import { useConditionCategoryMatch } from "@/hooks/useConditionCategoryMatch";
import CategoryMismatchError from "@/components/CategoryMismatchError";
import ListingPreviewDialog from "@/components/ListingPreviewDialog";
import { formatZAR } from "@/lib/currency";

const DELIVERY_OPTIONS = [
  { value: "collect", label: "Collection (buyer picks up)" },
  { value: "courier", label: "Courier delivery" },
  { value: "post", label: "Postal service" },
];

const editListingSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(5000, "Description must be less than 5000 characters"),
  category_id: z.string().uuid("Please select a category"),
  subcategory_id: z.string().optional(),

  condition: z.string().trim().max(80).optional(),
  condition_option_id: z.string().uuid().optional(),
  location: z.string().trim().min(1, "Location is required").max(200),
  delivery_options: z.array(z.string()).min(1, "Select at least one delivery option"),
  fixed_price: z.string().optional(),
});

type EditListingFormValues = z.infer<typeof editListingSchema>;

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

// Module-scoped store for failed replacement Files. Survives navigation within
// the same tab (cleared on full reload). Keyed by `${listingId}::${imageUrl}`.
const failedReplaceFiles: Map<string, File> = new Map();
const failedFileKey = (listingId: string | undefined, url: string | undefined) =>
  listingId && url ? `${listingId}::${url}` : "";

// Structured replacement-error so each failed tile can explain what went wrong
// and what the user can do next.
type ReplaceErrorKind =
  | "validation"
  | "compression"
  | "upload"
  | "network"
  | "permission"
  | "unknown";
type ReplaceError = {
  kind: ReplaceErrorKind;
  title: string;
  hint: string;
  detail?: string;
};

const ALLOWED_REPLACE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_REPLACE_BYTES = 25 * 1024 * 1024; // 25 MB pre-compression cap

function validateReplacementFile(file: File): ReplaceError | null {
  const typeOk = ALLOWED_REPLACE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!typeOk) {
    return {
      kind: "validation",
      title: "Unsupported file type",
      hint: "Pick a JPG, PNG, WEBP, or HEIC image.",
      detail: file.type || file.name,
    };
  }
  if (file.size > MAX_REPLACE_BYTES) {
    return {
      kind: "validation",
      title: "Image is too large",
      hint: "Choose a photo under 25 MB, or shrink it before uploading.",
      detail: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
    };
  }
  if (file.size === 0) {
    return {
      kind: "validation",
      title: "Empty file",
      hint: "The selected file has no content. Pick a different image.",
    };
  }
  return null;
}

function classifyReplaceError(err: any, stage: "compression" | "upload"): ReplaceError {
  const raw = (err?.message || String(err || "")).toString();
  const lower = raw.toLowerCase();
  const detail = raw.slice(0, 200);

  if (stage === "compression") {
    return {
      kind: "compression",
      title: "Couldn't process this image",
      hint: "The file may be corrupted. Try a different photo or re-export it as JPG.",
      detail,
    };
  }

  if (!navigator.onLine || lower.includes("network") || lower.includes("failed to fetch")) {
    return {
      kind: "network",
      title: "Network error",
      hint: "Check your connection, then tap Retry.",
      detail,
    };
  }
  if (lower.includes("unauthor") || lower.includes("forbidden") || lower.includes("not allowed") || lower.includes("policy")) {
    return {
      kind: "permission",
      title: "Not allowed",
      hint: "Sign in again, then retry. If this persists, contact support.",
      detail,
    };
  }
  if (lower.includes("payload") || lower.includes("too large") || lower.includes("exceed")) {
    return {
      kind: "upload",
      title: "Upload rejected (too large)",
      hint: "Pick a smaller image and use Replace again.",
      detail,
    };
  }
  return {
    kind: "upload",
    title: "Upload failed",
    hint: "Tap Retry, or pick a different image with Replace again.",
    detail,
  };
}

const EditListing = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);


  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIndexRef = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [replaceErrors, setReplaceErrors] = useState<Record<number, ReplaceError>>({});
  // Failed replacement Files are persisted at module scope (failedReplaceFiles)
  // so Retry continues to work after navigating away and back.
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; url: string; name: string; status: "compressing" | "uploading" | "error"; error?: string }[]
  >([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelUploadRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);

  const cancelBatchUpload = () => {
    cancelUploadRef.current = true;
    setCancelling(true);
  };
  const [listingType, setListingType] = useState<string>("");
  const [listingStatus, setListingStatus] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<SelectedCondition | null>(null);
  const [hasConditionGroups, setHasConditionGroups] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const blockedEmitRef = useRef<{ attemptId: string | null; emitted: boolean }>({
    attemptId: null,
    emitted: false,
  });
  useEffect(() => {
    if (previewOpen) {
      blockedEmitRef.current = {
        attemptId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `att_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        emitted: false,
      };
    }
  }, [previewOpen]);
  const [conditionSyncError, setConditionSyncError] = useState<string | null>(null);
  // Track the original category_id of the listing so we can detect category changes
  // that should invalidate the existing condition selection.
  const originalCategoryIdRef = useRef<string | null>(null);

  const form = useForm<EditListingFormValues>({
    resolver: zodResolver(editListingSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      subcategory_id: "",
      condition: "",
      condition_option_id: undefined,
      location: "",
      delivery_options: [],
      fixed_price: "",
    },
  });

  const selectedCategoryId = form.watch("category_id");
  const conditionMatch = useConditionCategoryMatch({
    selectedCategoryId,
    selectedCondition,
    hasConditionGroups,
    source: "edit_listing",
  });

  useEffect(() => {
    // Throttled cleanup of stale failed-replace File entries in IndexedDB.
    void maybeCleanupFailedReplaceStore();
  }, []);

  useEffect(() => {
    const loadSubs = async () => {
      if (!selectedCategoryId) {
        setSubcategories([]);
        return;
      }
      const { data } = await supabase
        .from("subcategories")
        .select("id, category_id, name, sort_order")
        .eq("category_id", selectedCategoryId)
        .order("sort_order", { ascending: true });
      setSubcategories(data || []);
    };
    loadSubs();
  }, [selectedCategoryId]);

  // If the user changes category away from the original, clear the dynamic
  // condition selection — option ids are scoped per category.
  useEffect(() => {
    if (!selectedCategoryId) return;
    if (
      originalCategoryIdRef.current &&
      selectedCategoryId !== originalCategoryIdRef.current &&
      selectedCondition
    ) {
      setSelectedCondition(null);
      form.setValue("condition_option_id", undefined);
      form.setValue("condition", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId]);


  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (user && id) {
      fetchListing();
    }
  }, [user, id]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      toast.error("Failed to load categories");
    }
  };

  const fetchListing = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("id", id)
        .eq("seller_id", user!.id)
        .single();

      if (error) throw error;
      if (!data) {
        toast.error("Listing not found or you don't have permission to edit it");
        navigate("/dashboard");
        return;
      }

      setListingType(data.listing_type);
      setListingStatus(data.status);
      const images: string[] = data.images || [];
      setUploadedImages(images);

      // Restore persisted replace-failure markers (keyed by image URL).
      // Back-compat: older entries were plain strings.
      try {
        const raw = sessionStorage.getItem(`editListing:replaceErrors:${id}`);
        if (raw) {
          const byUrl = JSON.parse(raw) as Record<string, ReplaceError | string>;
          const restored: Record<number, ReplaceError> = {};
          images.forEach((url, i) => {
            const v = byUrl[url];
            if (!v) return;
            restored[i] =
              typeof v === "string"
                ? {
                    kind: "unknown",
                    title: "Replace failed",
                    hint: "Tap Retry, or pick a different image with Replace again.",
                    detail: v,
                  }
                : v;
          });
          if (Object.keys(restored).length) setReplaceErrors(restored);
        }
      } catch {
        /* ignore */
      }

      originalCategoryIdRef.current = data.category_id || null;

      // Load existing dynamic condition selection (listing_conditions row), if any.
      let existingOptionId: string | undefined;
      try {
        const { data: lc } = await supabase
          .from("listing_conditions")
          .select("option_id, category_condition_options!inner(id, name, slug, group_id, category_condition_groups!inner(category_id))")
          .eq("listing_id", id)
          .maybeSingle();
        if (lc && (lc as any).category_condition_options) {
          const opt = (lc as any).category_condition_options;
          existingOptionId = opt.id;
          setSelectedCondition({
            optionId: opt.id,
            optionName: opt.name,
            optionSlug: opt.slug,
            groupId: opt.group_id,
            groupCategoryId: opt.category_condition_groups?.category_id,
          });
        }
      } catch {
        /* no dynamic condition yet — fine for legacy listings */
      }

      form.reset({
        title: data.title,
        description: data.description,
        category_id: data.category_id || "",
        subcategory_id: (data as any).subcategory_id || "",
        condition: data.condition || "",
        condition_option_id: existingOptionId,
        location: data.location || "",
        delivery_options: data.delivery_options || [],
        fixed_price: data.fixed_price?.toString() || "",
      });

    } catch (error) {
      toast.error("Failed to load listing");
      navigate("/dashboard");
    } finally {
      setFetching(false);
    }
  };

  // Clean up any outstanding blob preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist failed-replace markers keyed by image URL so they survive navigation
  useEffect(() => {
    if (!id) return;
    const key = `editListing:replaceErrors:${id}`;
    const entries = Object.entries(replaceErrors)
      .map(([idx, msg]) => [uploadedImages[Number(idx)], msg] as const)
      .filter(([url]) => !!url);
    try {
      if (entries.length === 0) {
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
      }
    } catch {
      /* ignore quota */
    }
  }, [replaceErrors, uploadedImages, id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (!input.files || !user) return;

    const files = Array.from(input.files);
    input.value = "";
    if (files.length === 0) return;

    if (uploadedImages.length + files.length > 8) {
      toast.error("Maximum 8 images allowed");
      return;
    }

    cancelUploadRef.current = false;
    setCancelling(false);
    setUploading(true);
    setBatchProgress({ done: 0, total: files.length });
    const successUrls: string[] = [];
    const failures: { name: string; reason: string }[] = [];
    let cancelledCount = 0;

    try {
      for (const original of files) {
        if (cancelUploadRef.current) {
          cancelledCount = files.length - (successUrls.length + failures.length);
          break;
        }
        const previewId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        const isHeic =
          /heic|heif/i.test(original.type) || /\.(heic|heif)$/i.test(original.name);
        const initialUrl = isHeic ? "" : URL.createObjectURL(original);
        setPendingPreviews((prev) => [
          ...prev,
          { id: previewId, url: initialUrl, name: original.name, status: "compressing" },
        ]);

        try {
          const [file] = await compressImages([original], {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8,
            maxSizeMB: 1,
          });

          // Swap preview to the compressed JPEG — renders reliably on iOS Safari
          const compressedPreviewUrl = URL.createObjectURL(file);
          setPendingPreviews((prev) =>
            prev.map((p) => {
              if (p.id !== previewId) return p;
              if (p.url && p.url !== compressedPreviewUrl) URL.revokeObjectURL(p.url);
              return { ...p, url: compressedPreviewUrl, status: "uploading" };
            })
          );

          const fileName = `${user.id}/${Date.now()}-${Math.random()
            .toString(36)
            .substring(2)}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("listing-images")
            .upload(fileName, file, {
              contentType: "image/jpeg",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const {
            data: { publicUrl },
          } = supabase.storage.from("listing-images").getPublicUrl(fileName);

          successUrls.push(publicUrl);
          setUploadedImages((prev) => [...prev, publicUrl]);
          setPendingPreviews((prev) => {
            const match = prev.find((p) => p.id === previewId);
            if (match?.url) URL.revokeObjectURL(match.url);
            return prev.filter((p) => p.id !== previewId);
          });
        } catch (err: any) {
          console.error("Image upload failed", original.name, err);
          failures.push({
            name: original.name,
            reason: err?.message || "Upload failed",
          });
          setPendingPreviews((prev) =>
            prev.map((p) =>
              p.id === previewId
                ? { ...p, status: "error", error: err?.message || "Upload failed" }
                : p
            )
          );
        } finally {
          setBatchProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev));
        }
      }

      if (successUrls.length > 0) {
        toast.success(`${successUrls.length} image(s) uploaded successfully`);
      }
      if (failures.length > 0) {
        toast.error(
          `${failures.length} image(s) failed: ${failures
            .map((f) => f.name)
            .join(", ")}`
        );
      }
      if (cancelUploadRef.current) {
        setPendingPreviews((prev) => {
          const keep: typeof prev = [];
          for (const p of prev) {
            if (p.status === "compressing" || p.status === "uploading") {
              if (p.url) URL.revokeObjectURL(p.url);
            } else {
              keep.push(p);
            }
          }
          return keep;
        });
        toast.info(
          cancelledCount > 0
            ? `Upload cancelled — ${cancelledCount} image(s) skipped`
            : "Upload cancelled"
        );
      }
    } finally {
      cancelUploadRef.current = false;
      setCancelling(false);
      setUploading(false);
      setBatchProgress(null);
    }
  };

  const dismissPendingPreview = (id: string) => {
    setPendingPreviews((prev) => {
      const match = prev.find((p) => p.id === id);
      if (match?.url) URL.revokeObjectURL(match.url);
      return prev.filter((p) => p.id !== id);
    });
  };


  const removeImage = async (url: string) => {
    try {
      const urlParts = url.split("/listing-images/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split("?")[0];
        await supabase.storage.from("listing-images").remove([filePath]);
      }
      setUploadedImages((prev) => prev.filter((img) => img !== url));
      toast.success("Image removed");
    } catch (error) {
      toast.error("Failed to remove image");
    }
  };

  const triggerReplace = (index: number) => {
    replaceTargetIndexRef.current = index;
    replaceInputRef.current?.click();
  };

  const performReplace = async (index: number, file: File) => {
    if (!user) return;
    const oldUrl = uploadedImages[index];
    if (!oldUrl) return;

    setReplacingIndex(index);
    setReplaceErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });

    // Up-front validation — distinguish from real upload errors.
    const validationError = validateReplacementFile(file);
    if (validationError) {
      // Don't cache the file for Retry — same file will fail again.
      failedReplaceFiles.delete(failedFileKey(id, oldUrl));
      void deleteFailedReplaceFile(failedFileKey(id, oldUrl));
      setReplaceErrors((prev) => ({ ...prev, [index]: validationError }));
      toast.error(`${validationError.title}: ${validationError.hint}`);
      setReplacingIndex(null);
      return;
    }

    let stage: "compression" | "upload" = "compression";
    try {
      const [compressed] = await compressImages([file], {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxSizeMB: 1,
      });

      stage = "upload";
      const fileName = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(fileName, compressed, { contentType: "image/jpeg", upsert: false });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("listing-images").getPublicUrl(fileName);

      setUploadedImages((prev) => prev.map((u, i) => (i === index ? publicUrl : u)));

      // Best-effort delete of the old file
      try {
        const parts = oldUrl.split("/listing-images/");
        if (parts.length > 1) {
          await supabase.storage
            .from("listing-images")
            .remove([parts[1].split("?")[0]]);
        }
      } catch {
        /* ignore */
      }

      failedReplaceFiles.delete(failedFileKey(id, oldUrl));
      void deleteFailedReplaceFile(failedFileKey(id, oldUrl));
      toast.success("Image replaced");
    } catch (err: any) {
      console.error("Image replace failed", err);
      const classified = classifyReplaceError(err, stage);
      // Cache the file so Retry can reuse it (only useful for transient errors).
      failedReplaceFiles.set(failedFileKey(id, oldUrl), file);
      void setFailedReplaceFile(failedFileKey(id, oldUrl), file);
      setReplaceErrors((prev) => ({ ...prev, [index]: classified }));
      toast.error(`${classified.title}: ${classified.hint}`);
    } finally {
      setReplacingIndex(null);
    }
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    const index = replaceTargetIndexRef.current;
    input.value = "";
    replaceTargetIndexRef.current = null;
    if (!file || index === null) return;
    await performReplace(index, file);
  };

  const retryReplace = async (index: number) => {
    const url = uploadedImages[index];
    const key = failedFileKey(id, url);
    let file = failedReplaceFiles.get(key);
    if (!file) {
      // Try IndexedDB (survives full page reload)
      file = await getFailedReplaceFile(key);
      if (file) failedReplaceFiles.set(key, file);
    }
    if (!file) {
      // Still nothing — fall back to opening the picker
      triggerReplace(index);
      return;
    }
    await performReplace(index, file);
  };

  const dismissReplaceError = (index: number) => {
    const key = failedFileKey(id, uploadedImages[index]);
    failedReplaceFiles.delete(key);
    void deleteFailedReplaceFile(key);
    setReplaceErrors((prev) => {
      if (!(index in prev)) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };



  const reorderImages = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setUploadedImages((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };




  const onSubmit = async (values: EditListingFormValues) => {
    if (!user || !id) return;

    // Enforce dynamic condition selection when the category has condition groups.
    if (hasConditionGroups && !selectedCondition) {
      toast.error("Please select a condition for this category.");
      return;
    }

    // Client-side pre-validation: condition's group must belong to the selected category.
    if (conditionMatch.isMismatch) {
      const friendly = conditionMatch.mismatchMessage;
      setConditionSyncError(friendly);
      toast.error("Condition doesn't match category", { description: friendly });
      return;
    }

    setConditionSyncError(null);
    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        subcategory_id: values.subcategory_id || null,

        condition: selectedCondition?.optionName || values.condition || null,
        location: values.location,
        delivery_options: values.delivery_options,
        images: uploadedImages,
      };

      if (listingType === "fixed_price" && values.fixed_price) {
        updateData.fixed_price = parseFloat(values.fixed_price);
      }

      const { error } = await supabase
        .from("listings")
        .update(updateData)
        .eq("id", id)
        .eq("seller_id", user.id);

      if (error) throw error;

      // Sync dynamic condition selection: clear existing row(s), then insert the
      // current one. Single-select is enforced by the listing_conditions trigger.
      try {
        const { error: delErr } = await supabase
          .from("listing_conditions")
          .delete()
          .eq("listing_id", id);
        if (delErr) throw delErr;

        if (selectedCondition) {
          const { error: insErr } = await supabase
            .from("listing_conditions")
            .insert([{ listing_id: id, option_id: selectedCondition.optionId }]);
          if (insErr) throw insErr;
        }
      } catch (condErr: unknown) {
        const normalized = normalizeListingError(condErr);
        setConditionSyncError(normalized.message);
        toast.error(normalized.title, {
          description: `${normalized.message} Your other changes were saved — try selecting the condition again.`,
        });
        // Keep form state intact; do not navigate away.
        return;
      }

      toast.success("Listing updated successfully!");
      navigate(`/listings/${id}`);
    } catch (error: any) {
      toast.error("Failed to update listing", {
        description: error?.message || "Something went wrong. Your changes are still here — please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || fetching) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
          <div className="container px-4 max-w-3xl">
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!user) return null;

  const isAuction = listingType === "auction";
  const hasBids = isAuction; // Auction fields are not editable

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
        <div className="container px-4 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Edit Listing</h1>
            <p className="text-muted-foreground">
              Update your listing details below
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
              <CardDescription>
                {isAuction
                  ? "Auction type, pricing, and end date cannot be changed after creation"
                  : "Update your listing information"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., iPhone 15 Pro Max 256GB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your item in detail..."
                            className="min-h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("subcategory_id", "");
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Subcategory (optional, depends on category) */}
                  {selectedCategoryId && subcategories.length > 0 && (
                    <FormField
                      control={form.control}
                      name="subcategory_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subcategory</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a subcategory (optional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {subcategories.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>
                                  {sub.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}


                  {/* Fixed Price (only for fixed_price listings) */}
                  {listingType === "fixed_price" && (
                    <FormField
                      control={form.control}
                      name="fixed_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fixed Price *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Price in ZAR</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Condition (dynamic per category) */}
                  <FormItem>
                    <FormLabel>Condition *</FormLabel>
                    <ConditionSelector
                      categoryId={selectedCategoryId || null}
                      value={selectedCondition?.optionId ?? null}
                      onChange={(sel) => {
                        setSelectedCondition(sel);
                        setConditionSyncError(null);
                        form.setValue("condition_option_id", sel?.optionId ?? undefined, {
                          shouldValidate: true,
                        });
                        form.setValue("condition", sel?.optionName ?? "");
                      }}
                      onGroupsLoaded={setHasConditionGroups}
                    />
                    {conditionMatch.isMissingRequired && !conditionSyncError && (
                      <p className="text-sm font-medium text-destructive mt-1">
                        Please select a condition.
                      </p>
                    )}
                    <CategoryMismatchError visible={conditionMatch.isMismatch && !conditionSyncError} />
                    {conditionSyncError && (
                      <div
                        role="alert"
                        aria-live="polite"
                        className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                      >
                        {conditionSyncError}
                      </div>
                    )}
                  </FormItem>


                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., New York, NY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Delivery Options */}
                  <FormField
                    control={form.control}
                    name="delivery_options"
                    render={() => (
                      <FormItem>
                        <FormLabel>Delivery Options *</FormLabel>
                        <FormDescription>
                          Select how buyers can receive this item
                        </FormDescription>
                        <div className="space-y-2 mt-2">
                          {DELIVERY_OPTIONS.map((option) => (
                            <FormField
                              key={option.value}
                              control={form.control}
                              name="delivery_options"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(option.value)}
                                      onCheckedChange={(checked) => {
                                        const current = field.value || [];
                                        field.onChange(
                                          checked
                                            ? [...current, option.value]
                                            : current.filter((v: string) => v !== option.value)
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer">
                                    {option.label}
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload */}
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Product Images</FormLabel>
                      <FormDescription>
                        Upload up to 8 images of your product (JPG, PNG, WEBP). Drag thumbnails to reorder — the first image is your cover.
                      </FormDescription>
                    </div>

                    {(uploadedImages.length > 0 || pendingPreviews.length > 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {uploadedImages.map((url, index) => {
                          const isReplacing = replacingIndex === index;
                          const replaceError = replaceErrors[index];
                          return (
                            <div
                              key={url}
                              className={`relative group aspect-square transition-all ${
                                dragIndex === index ? "opacity-40 scale-95" : ""
                              } ${
                                dragOverIndex === index && dragIndex !== index
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg"
                                  : ""
                              }`}
                              draggable={!isReplacing && !uploading}
                              onDragStart={(e) => {
                                setDragIndex(index);
                                e.dataTransfer.effectAllowed = "move";
                                try {
                                  e.dataTransfer.setData("text/plain", String(index));
                                } catch {
                                  /* ignore */
                                }
                              }}
                              onDragOver={(e) => {
                                if (dragIndex === null) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverIndex !== index) setDragOverIndex(index);
                              }}
                              onDragLeave={() => {
                                if (dragOverIndex === index) setDragOverIndex(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (dragIndex !== null) reorderImages(dragIndex, index);
                                setDragIndex(null);
                                setDragOverIndex(null);
                              }}
                              onDragEnd={() => {
                                setDragIndex(null);
                                setDragOverIndex(null);
                              }}
                            >
                              <img
                                src={url}
                                alt={`Product ${index + 1}`}
                                className={`w-full h-full object-cover rounded-lg border cursor-grab active:cursor-grabbing ${
                                  isReplacing ? "opacity-50" : ""
                                }`}
                                draggable={false}
                              />
                              {index === 0 && (
                                <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wide bg-background/90 border rounded px-1.5 py-0.5 shadow-sm">
                                  Cover
                                </span>
                              )}
                              {isReplacing && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 rounded-lg">
                                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                                  <span className="text-[10px] uppercase tracking-wide text-foreground/80">
                                    Replacing
                                  </span>
                                </div>
                              )}
                              {!isReplacing && replaceError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/90 rounded-lg p-2 text-center">
                                  <span className="text-[10px] uppercase tracking-wide font-semibold text-destructive">
                                    {replaceError.title}
                                  </span>
                                  <span className="text-[10px] text-foreground/80 line-clamp-3 leading-snug">
                                    {replaceError.hint}
                                  </span>
                                  {replaceError.detail && (
                                    <span
                                      className="text-[9px] text-muted-foreground line-clamp-1"
                                      title={replaceError.detail}
                                    >
                                      {replaceError.detail}
                                    </span>
                                  )}
                                  <div className="flex flex-wrap gap-1 justify-center pt-0.5">
                                    {replaceError.kind !== "validation" && (
                                      <button
                                        type="button"
                                        onClick={() => retryReplace(index)}
                                        className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium"
                                      >
                                        Retry
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        {
                                          const k = failedFileKey(id, uploadedImages[index]);
                                          failedReplaceFiles.delete(k);
                                          void deleteFailedReplaceFile(k);
                                        }
                                        setReplaceErrors((prev) => {
                                          const next = { ...prev };
                                          delete next[index];
                                          return next;
                                        });
                                        triggerReplace(index);
                                      }}
                                      className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium"
                                    >
                                      Replace again
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => dismissReplaceError(index)}
                                      className="px-2 py-0.5 rounded-md border text-[10px] font-medium"
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              )}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">

                                <button
                                  type="button"
                                  onClick={() => triggerReplace(index)}
                                  disabled={isReplacing || uploading}
                                  className="p-1 bg-background/90 text-foreground rounded-full border shadow-sm disabled:opacity-50"
                                  aria-label="Replace image"
                                  title="Replace image"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeImage(url)}
                                  disabled={isReplacing}
                                  className="p-1 bg-destructive text-destructive-foreground rounded-full disabled:opacity-50"
                                  aria-label="Remove image"
                                  title="Remove image"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {pendingPreviews.map((p) => (
                          <div
                            key={p.id}
                            className="relative aspect-square rounded-lg border bg-muted overflow-hidden"
                          >
                            {p.url ? (
                              <img
                                src={p.url}
                                alt={p.name}
                                className={`w-full h-full object-cover ${
                                  p.status === "error" ? "opacity-40" : "opacity-70"
                                }`}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground px-2 text-center">
                                Preparing preview…
                              </div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40">
                              {p.status === "error" ? (
                                <span className="text-xs font-medium text-destructive px-2 text-center">
                                  {p.error || "Failed"}
                                </span>
                              ) : (
                                <>
                                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                                  <span className="text-[10px] uppercase tracking-wide text-foreground/80">
                                    {p.status === "compressing" ? "Compressing" : "Uploading"}
                                  </span>
                                </>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => dismissPendingPreview(p.id)}
                              className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                              aria-label="Dismiss"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {batchProgress && batchProgress.total > 0 && (
                      <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2 text-xs font-medium">
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {cancelling ? "Cancelling…" : "Uploading images"}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="tabular-nums text-muted-foreground">
                              {batchProgress.done} / {batchProgress.total}
                              <span className="ml-2 text-foreground">
                                {Math.round((batchProgress.done / batchProgress.total) * 100)}%
                              </span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={cancelBatchUpload}
                              disabled={cancelling}
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <Progress
                          value={(batchProgress.done / batchProgress.total) * 100}
                          className="h-2"
                        />
                      </div>
                    )}

                    {uploadedImages.length < 8 && (
                      <div>
                        <label
                          htmlFor="image-upload"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {uploading ? "Uploading..." : "Click to upload images"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {uploadedImages.length}/8 images
                            </p>
                          </div>
                          <input
                            id="image-upload"
                            type="file"
                            className="hidden"
                            accept="image/*,image/heic,image/heif"
                            multiple
                            onChange={handleImageUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    )}

                    <input
                      ref={replaceInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*,image/heic,image/heif"
                      onChange={handleReplaceImage}
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/listings/${id}`)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={async () => {
                        const ok = await form.trigger();
                        if (!ok) return;
                        if (conditionMatch.blocksSubmit) {
                          toast.error(conditionMatch.mismatchMessage);
                          return;
                        }
                        setPreviewOpen(true);
                      }}
                      disabled={
                        loading ||
                        !!conditionSyncError ||
                        conditionMatch.blocksSubmit
                      }
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Review & Save
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <ListingPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            submitting={loading}
            conditionMatch={conditionMatch}
            mode="edit"
            values={{
              title: form.watch("title"),
              description: form.watch("description"),
              categoryName: categories.find((c) => c.id === form.watch("category_id"))?.name,
              subcategoryName: subcategories.find((s) => s.id === form.watch("subcategory_id"))?.name,
              conditionName: selectedCondition?.optionName,
              listingType: "fixed_price",
              priceDisplay: form.watch("fixed_price")
                ? formatZAR(Number(form.watch("fixed_price")))
                : undefined,
              location: form.watch("location"),
              deliveryOptions: form.watch("delivery_options") as string[] | undefined,
              images: uploadedImages,
            }}
            onConfirm={() => {
              if (conditionMatch.blocksSubmit) {
                if (!blockedEmitRef.current.emitted) {
                  blockedEmitRef.current.emitted = true;
                  trackEvent("listing_preview_confirm_blocked", {
                    source: "edit_listing",
                    reason: conditionMatch.isMismatch ? "category_mismatch" : "missing_required_condition",
                    category_id: selectedCategoryId ?? null,
                    option_id: selectedCondition?.optionId ?? null,
                    attempt_id: blockedEmitRef.current.attemptId,
                  });
                }
                return;
              }
              form.handleSubmit(async (v) => {
                await onSubmit(v);
                setPreviewOpen(false);
              })();
            }}
          />
        </div>
      </main>
    </>
  );
};

export default EditListing;
