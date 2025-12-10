import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  listingId: string;
  variant?: "icon" | "default";
  className?: string;
}

const FavoriteButton = ({ listingId, variant = "icon", className }: FavoriteButtonProps) => {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkFavoriteStatus();
    }
  }, [user, listingId]);

  const checkFavoriteStatus = async () => {
    if (!user) return;

    const { data } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listingId)
      .maybeSingle();

    setIsFavorited(!!data);
  };

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to save favorites");
      return;
    }

    setLoading(true);
    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("listing_id", listingId);

        if (error) throw error;
        setIsFavorited(false);
        toast.success("Removed from favorites");
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            listing_id: listingId,
          });

        if (error) throw error;
        setIsFavorited(true);
        toast.success("Added to favorites");
      }
    } catch (error: any) {
      toast.error("Failed to update favorites");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleFavorite}
        disabled={loading}
        className={cn(
          "h-8 w-8 rounded-full",
          isFavorited ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <Heart className={cn("h-5 w-5", isFavorited && "fill-current")} />
      </Button>
    );
  }

  return (
    <Button
      variant={isFavorited ? "default" : "outline"}
      onClick={toggleFavorite}
      disabled={loading}
      className={cn(className)}
    >
      <Heart className={cn("h-4 w-4 mr-2", isFavorited && "fill-current")} />
      {isFavorited ? "Saved" : "Save"}
    </Button>
  );
};

export default FavoriteButton;