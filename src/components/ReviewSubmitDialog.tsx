import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comment: z.string().trim().max(500, "Review must be less than 500 characters").optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ReviewSubmitDialogProps {
  listingId: string;
  reviewedUserId: string;
  reviewedUserName: string;
  onReviewSubmitted: () => void;
  children: React.ReactNode;
}

const ReviewSubmitDialog = ({
  listingId,
  reviewedUserId,
  reviewedUserName,
  onReviewSubmitted,
  children,
}: ReviewSubmitDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
    },
  });

  const selectedRating = form.watch("rating");

  const onSubmit = async (values: ReviewFormValues) => {
    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to submit a review");
        return;
      }

      const { error } = await supabase.from("reviews").insert({
        reviewer_id: user.id,
        reviewed_user_id: reviewedUserId,
        listing_id: listingId,
        rating: values.rating,
        comment: values.comment || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("You have already reviewed this user for this transaction");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Review submitted successfully");
      setOpen(false);
      form.reset();
      onReviewSubmitted();
    } catch (error: any) {
      toast.error(error.message || "Failed to submit review");
      console.error("Review submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Review {reviewedUserName}</DialogTitle>
          <DialogDescription>
            Share your experience with this transaction. Your feedback helps build trust in the
            community.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => field.onChange(rating)}
                          onMouseEnter={() => setHoveredRating(rating)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              rating <= (hoveredRating || selectedRating)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                      {selectedRating > 0 && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          {selectedRating} star{selectedRating !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share details about your experience..."
                      className="resize-none"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value?.length || 0}/500 characters
                  </p>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || selectedRating === 0}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Review
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewSubmitDialog;
