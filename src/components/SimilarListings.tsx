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
  created_at: string;
}

interface SimilarListingsProps {
  categoryId: string | null;
  currentListingId: string;
  currentTitle?: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "with", "of", "in", "on", "at",
  "to", "from", "by", "is", "are", "was", "were", "be", "been", "being", "as",
  "it", "its", "this", "that", "these", "those", "new", "used", "good",
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

export default function SimilarListings({ categoryId, currentListingId, currentTitle }: SimilarListingsProps) {
  const [items, setItems] = useState<SimilarListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) {
      setLoading(false);
      return;
    }

    const fetchSimilar = async () => {
      // Fetch a wider pool, then rank client-side by relevance + recency
      const { data } = await supabase
        .from("listings")
        .select("id, title, images, listing_type, fixed_price, starting_price, current_bid, created_at")
        .eq("category_id", categoryId)
        .eq("status", "active")
        .neq("id", currentListingId)
        .order("created_at", { ascending: false })
        .limit(40);

      const pool = data || [];
      const keywords = new Set(tokenize(currentTitle || ""));
      const now = Date.now();

      const scored = pool.map((item) => {
        const titleTokens = tokenize(item.title);
        const matches = titleTokens.filter((t) => keywords.has(t)).length;
        // Relevance: keyword overlap (heavily weighted)
        const relevance = matches * 10;
        // Recency: decays over ~30 days, max ~5
        const ageDays = (now - new Date(item.created_at).getTime()) / 86400000;
        const recency = Math.max(0, 5 - ageDays / 6);
        return { item, score: relevance + recency };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.item.created_at).getTime() - new Date(a.item.created_at).getTime();
      });

      setItems(scored.slice(0, 8).map((s) => s.item));
      setLoading(false);
    };

    fetchSimilar();
  }, [categoryId, currentListingId, currentTitle]);

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
