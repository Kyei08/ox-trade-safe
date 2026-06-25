import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { compressImages } from "@/lib/imageCompression";
import ConditionSelector, { type SelectedCondition } from "@/components/ConditionSelector";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  resolveDraft,
  pushRemoteDraft,
  clearRemoteDraft,
  hasMeaningfulDraft,
} from "@/lib/createListingDraft";

const DELIVERY_OPTIONS = [
  { value: "collect", label: "Collection (buyer picks up)" },
  { value: "courier", label: "Courier delivery" },
  { value: "post", label: "Postal service" },
];

const listingSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(5000, "Description must be less than 5000 characters"),
  category_id: z.string().uuid("Please select a category"),
  subcategory_id: z.string().optional(),

  listing_type: z.enum(["fixed_price", "auction"]),
  condition: z.string().trim().max(80).optional(),
  condition_option_id: z.string().uuid().optional(),
  location: z.string().trim().min(1, "Location is required").max(200),
  delivery_options: z.array(z.string()).min(1, "Select at least one delivery option"),
  fixed_price: z.string().optional(),
  starting_price: z.string().optional(),
  reserve_price: z.string().optional(),
  auction_ends_at: z.string().optional(),
}).refine((data) => {
  if (data.listing_type === "fixed_price") {
    return data.fixed_price && parseFloat(data.fixed_price) > 0;
  }
  return true;
}, {
  message: "Fixed price must be greater than 0",
  path: ["fixed_price"],
}).refine((data) => {
  if (data.listing_type === "auction") {
    return data.starting_price && parseFloat(data.starting_price) > 0;
  }
  return true;
}, {
  message: "Starting price must be greater than 0",
  path: ["starting_price"],
}).refine((data) => {
  if (data.listing_type === "auction") {
    return data.auction_ends_at && new Date(data.auction_ends_at) > new Date();
  }
  return true;
}, {
  message: "Auction end date must be in the future",
  path: ["auction_ends_at"],
});

type ListingFormValues = z.infer<typeof listingSchema>;

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


const CreateListing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const skipNextConditionResetRef = useRef(false);
  const didHydrateFromUrlRef = useRef(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; url: string; name: string; status: "compressing" | "uploading" | "error"; error?: string }[]
  >([]);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelUploadRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<SelectedCondition | null>(null);
  const [hasConditionGroups, setHasConditionGroups] = useState(false);

  const cancelBatchUpload = () => {
    cancelUploadRef.current = true;
    setCancelling(true);
  };
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("seller_verification_status")
        .eq("id", user.id)
        .maybeSingle();
      setVerificationStatus(data?.seller_verification_status ?? "not_started");
      setCheckingVerification(false);
    })();
  }, [user]);


  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      subcategory_id: "",
      listing_type: "fixed_price",

      condition: "",
      condition_option_id: undefined,
      location: "",
      delivery_options: [],
      fixed_price: "",
      starting_price: "",
      reserve_price: "",
      auction_ends_at: "",
    },
  });

  const listingType = form.watch("listing_type");
  const selectedCategoryId = form.watch("category_id");

  // Load subcategories whenever the chosen category changes
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
    // Reset condition when category changes (skip during URL hydration)
    if (skipNextConditionResetRef.current) {
      skipNextConditionResetRef.current = false;
    } else {
      setSelectedCondition(null);
      form.setValue("condition_option_id", undefined);
      form.setValue("condition", "");
    }
  }, [selectedCategoryId]);

  // Hydrate from saved draft + URL params on first mount.
  // URL params take precedence over draft values for category + condition.
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    if (didHydrateFromUrlRef.current) return;
    if (!user) return;
    didHydrateFromUrlRef.current = true;

    const urlCategory = searchParams.get("category");
    const urlOption = searchParams.get("option");

    (async () => {
      // Pick the freshest draft between local cache and the backend
      const draft = await resolveDraft(user.id);

      // 1) Restore non-category/option fields from draft
      if (draft && hasMeaningfulDraft(draft)) {
        const v = draft.values;
        const current = form.getValues();
        form.reset({
          ...current,
          title: v.title ?? current.title,
          description: v.description ?? current.description,
          subcategory_id: v.subcategory_id ?? current.subcategory_id,
          listing_type: v.listing_type ?? current.listing_type,
          location: v.location ?? current.location,
          delivery_options: v.delivery_options ?? current.delivery_options,
          fixed_price: v.fixed_price ?? current.fixed_price,
          starting_price: v.starting_price ?? current.starting_price,
          reserve_price: v.reserve_price ?? current.reserve_price,
          auction_ends_at: v.auction_ends_at ?? current.auction_ends_at,
          // category/option handled below
          category_id: current.category_id,
          condition: current.condition,
          condition_option_id: current.condition_option_id,
        });
        if (draft.uploadedImages?.length) {
          setUploadedImages(draft.uploadedImages);
        }
        setDraftRestored(true);
      }

      // 2) Category + condition: URL wins, else draft
      const effectiveCategory = urlCategory ?? draft?.values.category_id ?? null;
      const effectiveOption = urlOption ?? draft?.values.condition_option_id ?? null;

      if (effectiveCategory) {
        if (effectiveOption) skipNextConditionResetRef.current = true;
        form.setValue("category_id", effectiveCategory);
      }
      if (effectiveOption) {
        // Prefer the cached condition from draft if it matches
        if (draft?.selectedCondition && draft.selectedCondition.optionId === effectiveOption) {
          setSelectedCondition(draft.selectedCondition);
          form.setValue("condition_option_id", draft.selectedCondition.optionId);
          form.setValue("condition", draft.selectedCondition.optionName);
        } else {
          const { data } = await supabase
            .from("category_condition_options")
            .select("id, name, slug, group_id, category_condition_groups!inner(category_id)")
            .eq("id", effectiveOption)
            .maybeSingle();
          if (data) {
            const catId =
              (data as any).category_condition_groups?.category_id ?? effectiveCategory ?? null;
            if (catId && !effectiveCategory) {
              skipNextConditionResetRef.current = true;
              form.setValue("category_id", catId);
            }
            setSelectedCondition({
              optionId: data.id,
              optionName: data.name,
              optionSlug: data.slug,
              groupId: data.group_id,
            });
            form.setValue("condition_option_id", data.id);
            form.setValue("condition", data.name);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep URL in sync with category + condition selection
  useEffect(() => {
    if (!didHydrateFromUrlRef.current) return;
    const next = new URLSearchParams(searchParams);
    if (selectedCategoryId) next.set("category", selectedCategoryId);
    else next.delete("category");
    if (selectedCondition?.optionId) next.set("option", selectedCondition.optionId);
    else next.delete("option");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [selectedCategoryId, selectedCondition?.optionId]);

  // Persist draft on changes (debounced)
  const watchedValues = form.watch();
  useEffect(() => {
    if (!user || !didHydrateFromUrlRef.current) return;
    const t = setTimeout(() => {
      const payload = {
        values: {
          title: watchedValues.title,
          description: watchedValues.description,
          category_id: watchedValues.category_id,
          subcategory_id: watchedValues.subcategory_id,
          listing_type: watchedValues.listing_type,
          condition: watchedValues.condition,
          condition_option_id: watchedValues.condition_option_id,
          location: watchedValues.location,
          delivery_options: watchedValues.delivery_options,
          fixed_price: watchedValues.fixed_price,
          starting_price: watchedValues.starting_price,
          reserve_price: watchedValues.reserve_price,
          auction_ends_at: watchedValues.auction_ends_at,
        },
        uploadedImages,
        selectedCondition,
      };
      // Fast local cache
      saveDraft(user.id, payload);
      // Cross-device sync (fire & forget)
      void pushRemoteDraft(user.id, payload);
    }, 600);
    return () => clearTimeout(t);
  }, [user, watchedValues, uploadedImages, selectedCondition]);

  const discardDraft = () => {
    if (!user) return;
    clearDraft(user.id);
    void clearRemoteDraft(user.id);
    form.reset({
      title: "",
      description: "",
      category_id: "",
      subcategory_id: "",
      listing_type: "fixed_price",
      condition: "",
      condition_option_id: undefined,
      location: "",
      delivery_options: [],
      fixed_price: "",
      starting_price: "",
      reserve_price: "",
      auction_ends_at: "",
    });
    setUploadedImages([]);
    setSelectedCondition(null);
    setDraftRestored(false);
    setSearchParams(new URLSearchParams(), { replace: true });
    toast.success("Draft discarded");
  };




  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Clean up any outstanding blob preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingPreviews.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Failed to load categories");
      console.error(error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    if (!input.files || !user) return;

    const files = Array.from(input.files);
    // Reset input value immediately so the same file can be reselected after errors
    input.value = "";
    if (files.length === 0) return;

    // Limit to 8 images total
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
        // Show an immediate placeholder. For HEIC/HEIF the browser cannot render
        // a blob URL of the original — we'll swap to the compressed JPEG preview below.
        const isHeic =
          /heic|heif/i.test(original.type) || /\.(heic|heif)$/i.test(original.name);
        const initialUrl = isHeic ? "" : URL.createObjectURL(original);
        setPendingPreviews((prev) => [
          ...prev,
          { id: previewId, url: initialUrl, name: original.name, status: "compressing" },
        ]);

        try {
          // Compress one at a time (iOS Safari struggles with parallel canvas decodes)
          const [file] = await compressImages([original], {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.8,
            maxSizeMB: 1,
          });

          // Generate a preview URL from the compressed JPEG — guaranteed to render
          // even when the source was HEIC/HEIF on iOS Safari.
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
          // Stream successful uploads into UI immediately
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
        // Drop any still-pending (compressing/uploading) previews left behind
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
      // Extract file path from URL
      const urlParts = url.split("/listing-images/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1].split("?")[0];
        await supabase.storage.from("listing-images").remove([filePath]);
      }
      setUploadedImages((prev) => prev.filter((img) => img !== url));
      toast.success("Image removed");
    } catch (error: any) {
      toast.error("Failed to remove image");
      console.error(error);
    }
  };

  const onSubmit = async (values: ListingFormValues) => {
    if (!user) return;

    // Enforce dynamic condition selection when this category has groups
    if (hasConditionGroups && !selectedCondition) {
      toast.error("Please select a condition for this item");
      return;
    }

    try {
      setLoading(true);

      const listingData: any = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        subcategory_id: values.subcategory_id || null,

        listing_type: values.listing_type,
        condition: selectedCondition?.optionName || values.condition || null,
        location: values.location,
        seller_id: user.id,
        status: "active",
        images: uploadedImages,
        delivery_options: values.delivery_options,
      };

      if (values.listing_type === "fixed_price" && values.fixed_price) {
        listingData.fixed_price = parseFloat(values.fixed_price);
      }

      if (values.listing_type === "auction") {
        if (values.starting_price) {
          listingData.starting_price = parseFloat(values.starting_price);
          listingData.current_bid = parseFloat(values.starting_price);
        }
        if (values.reserve_price) {
          listingData.reserve_price = parseFloat(values.reserve_price);
        }
        if (values.auction_ends_at) {
          listingData.auction_ends_at = values.auction_ends_at;
        }
      }

      const { data, error } = await supabase
        .from("listings")
        .insert([listingData])
        .select()
        .single();

      if (error) throw error;

      // Persist dynamic condition selection into the junction table
      if (data && selectedCondition) {
        const { error: condErr } = await supabase
          .from("listing_conditions")
          .insert([{ listing_id: data.id, option_id: selectedCondition.optionId }]);
        if (condErr) {
          console.error("Failed to save condition:", condErr);
          const msg = condErr.message || "";
          if (/does not belong to this listing's category/i.test(msg)) {
            toast.error("Selected condition doesn't belong to this category. Please re-select.");
          } else if (/only have one condition selected/i.test(msg)) {
            toast.error("Only one condition can be selected per listing.");
          } else {
            toast.error("Couldn't save the selected condition. Please try again.");
          }
          // Roll back the listing so the user can retry cleanly.
          await supabase.from("listings").delete().eq("id", data.id);
          return;
        }
      }



      if (user) {
        clearDraft(user.id);
        void clearRemoteDraft(user.id);
      }
      toast.success("Listing created successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to create listing");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
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

  if (!checkingVerification && verificationStatus !== "approved") {
    const labels: Record<string, { title: string; description: string; cta: string }> = {
      not_started: {
        title: "Verify your seller account",
        description: "Complete seller verification before creating listings. This keeps the marketplace safe for buyers.",
        cta: "Start verification",
      },
      pending_review: {
        title: "Verification in review",
        description: "Your submission is being reviewed. You'll be able to create listings once it's approved.",
        cta: "View status",
      },
      requires_more_info: {
        title: "More information needed",
        description: "We've requested updates to your verification. Please provide them to continue.",
        cta: "Update submission",
      },
      rejected: {
        title: "Verification rejected",
        description: "Your previous submission was rejected. Review the notes and resubmit to continue.",
        cta: "Resubmit",
      },
    };
    const meta = labels[verificationStatus || "not_started"] || labels.not_started;
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
          <div className="container px-4 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle>{meta.title}</CardTitle>
                <CardDescription>{meta.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/seller-verification")}>{meta.cta}</Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }


  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16 sm:pt-32 pb-12">
        <div className="container px-4 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Create New Listing</h1>
            <p className="text-muted-foreground">
              Fill in the details below to list your item for sale
            </p>
          </div>

          {draftRestored && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm animate-in fade-in slide-in-from-top-1">
              <span className="text-muted-foreground">
                We restored your unsaved draft. Your progress is auto-saved on this device.
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
                Discard draft
              </Button>
            </div>
          )}


          <Card>
            <CardHeader>
              <CardTitle>Listing Details</CardTitle>
              <CardDescription>
                Provide accurate information to attract potential buyers
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
                        <FormDescription>
                          Clear, descriptive title for your item
                        </FormDescription>
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
                        <FormDescription>
                          Include condition, features, and any relevant details
                        </FormDescription>
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


                  {/* Listing Type */}
                  <FormField
                    control={form.control}
                    name="listing_type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Listing Type *</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-1"
                          >
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="fixed_price" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Fixed Price - Sell at a set price
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="auction" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Auction - Let buyers bid
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Fixed Price */}
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

                  {/* Auction Fields */}
                  {listingType === "auction" && (
                    <>
                      <FormField
                        control={form.control}
                        name="starting_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starting Price *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Minimum bid amount in ZAR
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="reserve_price"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reserve Price (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Minimum price you'll accept (hidden from buyers)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="auction_ends_at"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Auction End Date *</FormLabel>
                            <FormControl>
                              <Input
                                type="datetime-local"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              When the auction will close
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  {/* Condition (dynamic per category) */}
                  <FormItem>
                    <FormLabel>Condition *</FormLabel>
                    <ConditionSelector
                      categoryId={selectedCategoryId || null}
                      value={selectedCondition?.optionId ?? null}
                      onChange={(sel) => {
                        setSelectedCondition(sel);
                        form.setValue("condition_option_id", sel?.optionId ?? undefined, {
                          shouldValidate: true,
                        });
                        form.setValue("condition", sel?.optionName ?? "");
                      }}
                      onGroupsLoaded={setHasConditionGroups}
                    />
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
                        <FormDescription>
                          City and state where the item is located
                        </FormDescription>
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

                  <div className="space-y-4">
                    <div>
                      <FormLabel>Product Images</FormLabel>
                      <FormDescription>
                        Upload up to 8 images of your product (JPG, PNG, WEBP)
                      </FormDescription>
                    </div>

                    {(uploadedImages.length > 0 || pendingPreviews.length > 0) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {uploadedImages.map((url, index) => (
                          <div key={url} className="relative group aspect-square">
                            <img
                              src={url}
                              alt={`Product ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg border"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(url)}
                              className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remove image"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
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
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        toast.success("Draft saved", {
                          description: "Your progress is saved on this device. Pick up where you left off anytime.",
                        });
                        navigate("/listings");
                      }}
                      disabled={loading}
                    >
                      Save & Exit
                    </Button>
                    <Button type="submit" disabled={loading} className="ml-auto">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Listing
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
};

export default CreateListing;
