import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gavel, Package } from "lucide-react";
import { formatZAR } from "@/lib/currency";

interface SimilarListing {
  id: string;
  title: string;
  images: string[] | null;
  listing_type: string;
  fixed_price: number | null;
  starting_price: number | null;
  current_bid: number | null;
}

interface SimilarListingsProps {
  categoryId: string | null;
  currentListingId: string;
}

export default function SimilarListings({ categoryId, currentListingId }: SimilarListingsProps) {
  const [items, setItems] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    const fetchSimilar = async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, images, listing_type, fixed_price, starting_price, current_bid")
        .eq("category_id", categoryId)
        .eq("status", "active")
        .neq("id", currentListingId)
        .order("created_at", { ascending: false })
        .limit(8);

      setItems(data || []);
      setLoading(false);
    };

    fetchSimilar();
  }, [categoryId, currentListingId]);

  if (loading || items.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Similar Listings</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const isAuction = item.listing_type === "auction";
          const price = isAuction
            ? item.current_bid || item.starting_price
            : item.fixed_price;
          const image = item.images?.[0];

          return (
            <Link key={item.id} to={`/listings/${item.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                <div className="aspect-square bg-muted overflow-hidden">
                  {image ? (
                    <img
                      src={image}
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Package className="w-8 h-8" />
                    </div>
                  )}
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <Badge variant={isAuction ? "default" : "secondary"} className="text-xs">
                    {isAuction ? (
                      <><Gavel className="w-3 h-3 mr-1" />Auction</>
                    ) : (
                      "Buy Now"
                    )}
                  </Badge>
                  <h3 className="font-medium text-sm line-clamp-2">{item.title}</h3>
                  <p className="text-primary font-semibold text-sm">
                    {price ? formatZAR(price) : "—"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
