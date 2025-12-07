import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Eye,
  DollarSign,
  Package,
  Gavel,
  ShoppingCart,
  BarChart3,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SellerAnalyticsProps {
  userId: string;
}

interface ListingStats {
  id: string;
  title: string;
  listing_type: string;
  status: string;
  view_count: number;
  bid_count: number;
  fixed_price: number | null;
  current_bid: number | null;
  starting_price: number | null;
  images: string[] | null;
}

interface AnalyticsData {
  totalListings: number;
  activeListings: number;
  soldListings: number;
  totalViews: number;
  totalBids: number;
  estimatedRevenue: number;
  popularItems: ListingStats[];
  recentSales: ListingStats[];
}

const SellerAnalytics = ({ userId }: SellerAnalyticsProps) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      const { data: listings, error } = await supabase
        .from("listings")
        .select("id, title, listing_type, status, view_count, bid_count, fixed_price, current_bid, starting_price, images")
        .eq("seller_id", userId);

      if (error) throw error;

      const allListings = listings || [];
      const active = allListings.filter((l) => l.status === "active");
      const sold = allListings.filter((l) => l.status === "sold");

      // Calculate total views and bids
      const totalViews = allListings.reduce((sum, l) => sum + (l.view_count || 0), 0);
      const totalBids = allListings.reduce((sum, l) => sum + (l.bid_count || 0), 0);

      // Calculate estimated revenue from sold items
      const estimatedRevenue = sold.reduce((sum, l) => {
        const price = l.listing_type === "auction" 
          ? (l.current_bid || l.starting_price || 0)
          : (l.fixed_price || 0);
        return sum + price;
      }, 0);

      // Get top 5 most viewed items
      const popularItems = [...allListings]
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 5);

      // Get recent sales
      const recentSales = sold.slice(0, 5);

      setAnalytics({
        totalListings: allListings.length,
        activeListings: active.length,
        soldListings: sold.length,
        totalViews,
        totalBids,
        estimatedRevenue,
        popularItems,
        recentSales,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Unable to load analytics.</p>
        </CardContent>
      </Card>
    );
  }

  const statsCards = [
    {
      title: "Total Listings",
      value: analytics.totalListings,
      icon: Package,
      description: `${analytics.activeListings} active`,
      color: "text-blue-500",
    },
    {
      title: "Total Views",
      value: analytics.totalViews.toLocaleString(),
      icon: Eye,
      description: "Across all listings",
      color: "text-green-500",
    },
    {
      title: "Total Bids",
      value: analytics.totalBids,
      icon: Gavel,
      description: "On your auctions",
      color: "text-orange-500",
    },
    {
      title: "Revenue",
      value: formatCurrency(analytics.estimatedRevenue),
      icon: DollarSign,
      description: `${analytics.soldListings} items sold`,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Most Popular Items
            </CardTitle>
            <CardDescription>Your top performing listings by views</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.popularItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No listings yet</p>
            ) : (
              <div className="space-y-4">
                {analytics.popularItems.map((item, index) => (
                  <Link
                    key={item.id}
                    to={`/listings/${item.id}`}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {item.images && item.images[0] ? (
                        <img
                          src={item.images[0]}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {item.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Gavel className="h-3 w-3" />
                          {item.bid_count}
                        </span>
                      </div>
                    </div>
                    <Badge variant={item.status === "active" ? "default" : "secondary"}>
                      {item.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-500" />
              Recent Sales
            </CardTitle>
            <CardDescription>Your recently sold items</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.recentSales.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No sales yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Completed sales will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.recentSales.map((item) => {
                  const salePrice =
                    item.listing_type === "auction"
                      ? item.current_bid || item.starting_price
                      : item.fixed_price;

                  return (
                    <Link
                      key={item.id}
                      to={`/listings/${item.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-12 w-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {item.images && item.images[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.title}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {item.listing_type === "auction" ? "Auction" : "Fixed Price"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-emerald-600">
                          {formatCurrency(salePrice || 0)}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          Sold
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">
                {analytics.totalListings > 0
                  ? ((analytics.soldListings / analytics.totalListings) * 100).toFixed(1)
                  : 0}
                %
              </p>
              <p className="text-sm text-muted-foreground mt-1">Sell-through Rate</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">
                {analytics.totalListings > 0
                  ? (analytics.totalViews / analytics.totalListings).toFixed(0)
                  : 0}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Avg. Views per Listing</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">
                {analytics.soldListings > 0
                  ? formatCurrency(analytics.estimatedRevenue / analytics.soldListings)
                  : formatCurrency(0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Avg. Sale Price</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerAnalytics;
