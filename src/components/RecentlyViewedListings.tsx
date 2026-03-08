import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRecentlyViewed, RecentlyViewedItem } from "@/hooks/useRecentlyViewed";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { formatZAR } from "@/lib/currency";

interface Props {
  excludeId?: string;
}

const RecentlyViewedListings = ({ excludeId }: Props) => {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    const viewed = getRecentlyViewed().filter((i) => i.id !== excludeId);
    setItems(viewed);
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Recently Viewed</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item) => (
          <Link key={item.id} to={`/listings/${item.id}`}>
            <Card className="group cursor-pointer hover:shadow-lg transition-shadow h-full">
              <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    No image
                  </div>
                )}
                <Badge
                  variant={item.listing_type === "auction" ? "default" : "secondary"}
                  className="absolute top-2 left-2 text-xs"
                >
                  {item.listing_type === "auction" ? "Auction" : "Fixed"}
                </Badge>
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium line-clamp-1">{item.title}</p>
                <p className="text-sm font-bold text-primary mt-1">
                  {item.price != null ? formatZAR(item.price) : "N/A"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RecentlyViewedListings;
