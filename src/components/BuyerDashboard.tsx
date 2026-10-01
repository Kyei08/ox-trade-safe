import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import TrustBadges from "@/components/TrustBadges";
import { formatZAR } from "@/lib/currency";
import { formatDistanceToNow } from "date-fns";
import { ShoppingBag, Gavel, MessageSquare, ShieldCheck, ArrowRight, Package } from "lucide-react";

interface BuyerDashboardProps {
  userId: string;
}

interface Purchase {
  id: string;
  amount: number;
  status: string;
  tracking_number: string | null;
  created_at: string;
  listings: { id: string; title: string; images: string[] | null; listing_type: string } | null;
}

interface ActiveBid {
  id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
  listing: {
    id: string;
    title: string;
    status: string;
    current_bid: number | null;
    auction_ends_at: string | null;
  } | null;
}

interface ConversationSummary {
  id: string;
  updated_at: string;
  listingTitle: string;
  otherName: string;
  lastMessage: string;
  unreadCount: number;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const BuyerDashboard = ({ userId }: BuyerDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activeBids, setActiveBids] = useState<ActiveBid[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersRes, bidsRes, convsRes, profileRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, amount, status, tracking_number, created_at, listings(id, title, images, listing_type)")
          .eq("buyer_id", userId)
          .not("status", "in", "(pending,cancelled)")
          .order("created_at", { ascending: false }),
        supabase
          .from("bids")
          .select("id, amount, is_winning, created_at, listing:listings(id, title, status, current_bid, auction_ends_at)")
          .eq("bidder_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("conversations")
          .select("id, buyer_id, seller_id, updated_at, listings!inner(title), messages(content, created_at, is_read, sender_id)")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (bidsRes.error) throw bidsRes.error;
      if (convsRes.error) throw convsRes.error;

      setPurchases((ordersRes.data as any[]) || []);

      // Keep only bids on live auctions (dedupe by listing, latest bid per listing)
      const seen = new Map<string, ActiveBid>();
      for (const b of (bidsRes.data as any[]) || []) {
        if (!b.listing || b.listing.status !== "active") continue;
        if (!seen.has(b.listing.id)) seen.set(b.listing.id, b);
      }
      setActiveBids(Array.from(seen.values()));

      // Build conversation summaries with profiles + unread counts
      const rawConvs = (convsRes.data as any[]) || [];
      const otherIds = Array.from(new Set(rawConvs.map((c) => (c.buyer_id === userId ? c.seller_id : c.buyer_id))));
      const profilesMap: Record<string, string> = {};
      if (otherIds.length > 0) {
        const { data: profs } = await supabase.from("public_profiles").select("id, full_name").in("id", otherIds);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p.full_name || "User"; });
      }

      let unread = 0;
      const summaries: ConversationSummary[] = rawConvs.map((c) => {
        const otherId = c.buyer_id === userId ? c.seller_id : c.buyer_id;
        const msgs = (c.messages || []).sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const unreadCount = msgs.filter((m: any) => !m.is_read && m.sender_id !== userId).length;
        unread += unreadCount;
        return {
          id: c.id,
          updated_at: c.updated_at,
          listingTitle: c.listings?.title || "Listing",
          otherName: profilesMap[otherId] || "User",
          lastMessage: msgs[0]?.content || "No messages yet",
          unreadCount,
        };
      });
      setConversations(summaries);
      setUnreadTotal(unread);

      setProfile(profileRes.data);
    } catch (e: any) {
      console.error("Buyer dashboard load failed", e);
      setError(e?.message || "Couldn't load your buyer dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn't load your buyer dashboard</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={load}>Try again</Button>
        </CardContent>
      </Card>
    );
  }

  const winningCount = activeBids.filter((b) => b.is_winning).length;
  const verificationStatus = profile?.seller_verification_status || "not_started";
  const verificationLabel =
    verificationStatus === "approved"
      ? "Verified"
      : verificationStatus === "pending_review"
        ? "Pending review"
        : verificationStatus === "requires_more_info"
          ? "More info needed"
          : verificationStatus === "rejected"
            ? "Rejected"
            : "Not started";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4" /> Purchases
            </CardDescription>
            <CardTitle className="text-2xl">{purchases.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Gavel className="w-4 h-4" /> Active bids
            </CardDescription>
            <CardTitle className="text-2xl">
              {activeBids.length}
              {winningCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">{winningCount} winning</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Messages
            </CardDescription>
            <CardTitle className="text-2xl">
              {conversations.length}
              {unreadTotal > 0 && (
                <Badge variant="default" className="ml-2 align-middle">{unreadTotal} unread</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Verification
            </CardDescription>
            <CardTitle className="text-lg">{verificationLabel}</CardTitle>
          </CardHeader>
          {profile && (
            <CardContent className="pt-0">
              <TrustBadges profile={profile} size="sm" />
            </CardContent>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Purchases / won listings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">My purchases</CardTitle>
              <CardDescription>Listings you've bought or won</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {purchases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No purchases yet.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/listings">Browse listings</Link>
                </Button>
              </div>
            ) : (
              purchases.slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center gap-3 rounded-lg border p-3">
                  {order.listings?.images?.[0] ? (
                    <img
                      src={order.listings.images[0]}
                      alt={order.listings.title}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/listing/${order.listings?.id}`}
                      className="font-medium text-sm hover:underline line-clamp-1"
                    >
                      {order.listings?.title || "Listing"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      {order.tracking_number && ` · Tracking: ${order.tracking_number}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm">{formatZAR(order.amount)}</p>
                    <Badge variant="secondary" className="text-xs">
                      {ORDER_STATUS_LABEL[order.status] || order.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Active bids */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active bids</CardTitle>
            <CardDescription>Auctions you're bidding on</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeBids.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Gavel className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No active bids right now.</p>
              </div>
            ) : (
              activeBids.slice(0, 5).map((bid) => (
                <div key={bid.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <Link
                      to={`/listing/${bid.listing!.id}`}
                      className="font-medium text-sm hover:underline line-clamp-1"
                    >
                      {bid.listing!.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Your bid {formatZAR(bid.amount)} · Current {formatZAR(bid.listing!.current_bid ?? bid.amount)}
                    </p>
                  </div>
                  <Badge variant={bid.is_winning ? "default" : "secondary"} className="flex-shrink-0">
                    {bid.is_winning ? "Winning" : "Outbid"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Messages</CardTitle>
            <CardDescription>Your conversations with sellers and buyers</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/messages">
              View all <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No conversations yet.</p>
            </div>
          ) : (
            conversations.slice(0, 5).map((conv) => (
              <Link
                key={conv.id}
                to={`/messages/${conv.id}`}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarFallback>{conv.otherName.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{conv.otherName}</p>
                    {conv.unreadCount > 0 && (
                      <Badge variant="default" className="text-xs">{conv.unreadCount}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.listingTitle} · {conv.lastMessage}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerDashboard;
