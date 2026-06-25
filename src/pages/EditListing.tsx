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
import { compressImages } from "@/lib/imageCompression";

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

  condition: z.string().trim().min(1, "Condition is required").max(50),
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
  const [pendingPreviews, setPendingPreviews] = useState<
    { id: string; url: string; name: string; status: "compressing" | "uploading" | "error"; error?: string }[]
  >([]);
  const [listingType, setListingType] = useState<string>("");
  const [listingStatus, setListingStatus] = useState<string>("");

  const form = useForm<EditListingFormValues>({
    resolver: zodResolver(editListingSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      subcategory_id: "",
      condition: "",
      location: "",
      delivery_options: [],
      fixed_price: "",
    },
  });

  const selectedCategoryId = form.watch("category_id");

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
      setUploadedImages(data.images || []);

      form.reset({
        title: data.title,
        description: data.description,
        category_id: data.category_id || "",
        subcategory_id: (data as any).subcategory_id || "",
        condition: data.condition || "",
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

    setUploading(true);
    const successUrls: string[] = [];
    const failures: { name: string; reason: string }[] = [];

    try {
      for (const original of files) {
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
    } finally {
      setUploading(false);
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

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    const index = replaceTargetIndexRef.current;
    input.value = "";
    replaceTargetIndexRef.current = null;
    if (!file || index === null || !user) return;

    const oldUrl = uploadedImages[index];
    if (!oldUrl) return;

    setReplacingIndex(index);
    try {
      const [compressed] = await compressImages([file], {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxSizeMB: 1,
      });

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

      toast.success("Image replaced");
    } catch (err: any) {
      console.error("Image replace failed", err);
      toast.error(err?.message || "Failed to replace image");
    } finally {
      setReplacingIndex(null);
    }
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

    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        subcategory_id: values.subcategory_id || null,

        condition: values.condition,
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

      toast.success("Listing updated successfully!");
      navigate(`/listings/${id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update listing");
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

                  {/* Condition */}
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="like-new">Like New</SelectItem>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="fair">Fair</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
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

export default EditListing;
