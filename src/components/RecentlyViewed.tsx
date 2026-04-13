import { useNavigate } from "react-router-dom";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Clock } from "lucide-react";
import { formatZAR } from "@/lib/currency";

const RecentlyViewed = () => {
  const { recentlyViewed } = useRecentlyViewed();
  const navigate = useNavigate();

  if (recentlyViewed.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 bg-muted/30">
      <div className="container px-4">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-2xl sm:text-3xl font-bold">Recently Viewed</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {recentlyViewed.slice(0, 6).map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden group"
              onClick={() => navigate(`/listings/${item.id}`)}
            >
              <div className="aspect-square relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <Badge variant="outline" className="absolute top-2 left-2 text-[10px] bg-background/80 backdrop-blur-sm">
                  {item.listing_type === "auction" ? "Auction" : "Fixed"}
                </Badge>
              </div>
              <CardContent className="p-2 sm:p-3">
                <h3 className="font-medium text-xs sm:text-sm line-clamp-2 leading-tight mb-1">
                  {item.title}
                </h3>
                {item.price != null && (
                  <p className="text-xs sm:text-sm font-bold text-primary">
                    {formatZAR(item.price)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecentlyViewed;
