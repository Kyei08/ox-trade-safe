import { useEffect, useState } from "react";
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
import { Loader2, Upload, X } from "lucide-react";
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
  condition: z.string().trim().min(1, "Condition is required").max(50),
  location: z.string().trim().min(1, "Location is required").max(200),
  fixed_price: z.string().optional(),
});

type EditListingFormValues = z.infer<typeof editListingSchema>;

interface Category {
  id: string;
  name: string;
}

const EditListing = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [listingType, setListingType] = useState<string>("");
  const [listingStatus, setListingStatus] = useState<string>("");

  const form = useForm<EditListingFormValues>({
    resolver: zodResolver(editListingSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      condition: "",
      location: "",
      fixed_price: "",
    },
  });

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
        .order("name");

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
        condition: data.condition || "",
        location: data.location || "",
        fixed_price: data.fixed_price?.toString() || "",
      });
    } catch (error) {
      toast.error("Failed to load listing");
      navigate("/dashboard");
    } finally {
      setFetching(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;

    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (uploadedImages.length + files.length > 8) {
      toast.error("Maximum 8 images allowed");
      return;
    }

    try {
      setUploading(true);

      const compressedFiles = await compressImages(files, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
        maxSizeMB: 1,
      });

      const uploadPromises = compressedFiles.map(async (file) => {
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("listing-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("listing-images")
          .getPublicUrl(fileName);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedImages((prev) => [...prev, ...urls]);
      toast.success(`${files.length} image(s) uploaded successfully`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload images");
    } finally {
      setUploading(false);
    }
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

  const onSubmit = async (values: EditListingFormValues) => {
    if (!user || !id) return;

    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        condition: values.condition,
        location: values.location,
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
        <main className="min-h-screen bg-background pt-24 pb-12">
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
      <main className="min-h-screen bg-background pt-24 pb-12">
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
                        <Select onValueChange={field.onChange} value={field.value}>
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

                  {/* Image Upload */}
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Product Images</FormLabel>
                      <FormDescription>
                        Upload up to 8 images of your product (JPG, PNG, WEBP)
                      </FormDescription>
                    </div>

                    {uploadedImages.length > 0 && (
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
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={handleImageUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    )}
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
