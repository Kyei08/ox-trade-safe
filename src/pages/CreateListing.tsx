import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const listingSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(5000, "Description must be less than 5000 characters"),
  category_id: z.string().uuid("Please select a category"),
  listing_type: z.enum(["fixed_price", "auction"]),
  condition: z.string().trim().min(1, "Condition is required").max(50),
  location: z.string().trim().min(1, "Location is required").max(200),
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

const CreateListing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      title: "",
      description: "",
      category_id: "",
      listing_type: "fixed_price",
      condition: "",
      location: "",
      fixed_price: "",
      starting_price: "",
      reserve_price: "",
      auction_ends_at: "",
    },
  });

  const listingType = form.watch("listing_type");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Failed to load categories");
      console.error(error);
    }
  };

  const onSubmit = async (values: ListingFormValues) => {
    if (!user) return;

    try {
      setLoading(true);

      const listingData: any = {
        title: values.title,
        description: values.description,
        category_id: values.category_id,
        listing_type: values.listing_type,
        condition: values.condition,
        location: values.location,
        seller_id: user.id,
        status: "active",
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

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container px-4 max-w-3xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Create New Listing</h1>
            <p className="text-muted-foreground">
              Fill in the details below to list your item for sale
            </p>
          </div>

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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                          <FormDescription>Price in USD</FormDescription>
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
                              Minimum bid amount in USD
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

                  {/* Condition */}
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormDescription>
                          City and state where the item is located
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
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
