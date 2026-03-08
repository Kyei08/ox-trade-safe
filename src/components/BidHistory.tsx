import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZAR } from "@/lib/currency";

interface Bid {
  id: string;
  amount: number;
  bidder_id: string;
  created_at: string;
  is_winning: boolean;
  public_profiles: {
    full_name: string;
  };
}

interface BidHistoryProps {
  listingId: string;
  currentUserId?: string;
  auctionEnded?: boolean;
}

export default function BidHistory({ listingId, currentUserId, auctionEnded }: BidHistoryProps) {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBidId, setNewBidId] = useState<string | null>(null);

  const fetchBids = async () => {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select(`
          *,
          public_profiles!bidder_id (full_name)
        `)
        .eq("listing_id", listingId)
        .order("amount", { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error("Error fetching bids:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBids();

    // Real-time subscription for new bids
    const channel = supabase
      .channel(`bids-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          console.log("New bid received:", payload);
          setNewBidId(payload.new.id);
          fetchBids();
          // Clear animation after 3 seconds
          setTimeout(() => setNewBidId(null), 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listingId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (bids.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Bid History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            No bids yet. Be the first to bid!
          </p>
        </CardContent>
      </Card>
    );
  }

  const winningBid = bids.find((bid) => bid.is_winning);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Bid History
        </CardTitle>
        <CardDescription>{bids.length} bid{bids.length !== 1 ? "s" : ""} placed</CardDescription>
      </CardHeader>
      <CardContent>
        {auctionEnded && winningBid && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold text-primary">Winner</span>
            </div>
            <p className="text-lg font-bold">{winningBid.public_profiles.full_name}</p>
            <p className="text-2xl font-bold text-primary">${winningBid.amount.toFixed(2)}</p>
          </div>
        )}

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {bids.map((bid, index) => (
              <div
                key={bid.id}
                className={cn(
                  "flex justify-between items-center p-3 rounded-lg transition-all duration-300",
                  bid.id === newBidId && "ring-2 ring-primary animate-pulse",
                  bid.is_winning && !auctionEnded
                    ? "bg-primary/10 border border-primary"
                    : bid.bidder_id === currentUserId
                    ? "bg-accent/50 border border-accent"
                    : "bg-muted"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground w-6">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {bid.public_profiles.full_name}
                      {bid.bidder_id === currentUserId && (
                        <Badge variant="outline" className="text-xs">You</Badge>
                      )}
                      {bid.is_winning && !auctionEnded && (
                        <Badge variant="default" className="text-xs">Leading</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bid.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  bid.is_winning && "text-primary"
                )}>
                  ${bid.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
