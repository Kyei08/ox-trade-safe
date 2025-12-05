import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting auction finalization check...");

    // Find all active auctions that have ended
    const now = new Date().toISOString();
    const { data: endedAuctions, error: fetchError } = await supabase
      .from("listings")
      .select("id, title, current_bid, reserve_price, seller_id")
      .eq("listing_type", "auction")
      .eq("status", "active")
      .lt("auction_ends_at", now);

    if (fetchError) {
      console.error("Error fetching ended auctions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${endedAuctions?.length || 0} ended auctions to process`);

    const results = [];

    for (const auction of endedAuctions || []) {
      console.log(`Processing auction: ${auction.id} - ${auction.title}`);

      // Get the highest bid
      const { data: winningBid, error: bidError } = await supabase
        .from("bids")
        .select("id, bidder_id, amount")
        .eq("listing_id", auction.id)
        .order("amount", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bidError) {
        console.error(`Error fetching winning bid for ${auction.id}:`, bidError);
        continue;
      }

      let newStatus = "expired";
      let winnerId = null;

      if (winningBid) {
        // Check if reserve price is met (if set)
        const reserveMet = !auction.reserve_price || winningBid.amount >= auction.reserve_price;

        if (reserveMet) {
          newStatus = "sold";
          winnerId = winningBid.bidder_id;

          // Mark the winning bid
          await supabase
            .from("bids")
            .update({ is_winning: false })
            .eq("listing_id", auction.id);

          await supabase
            .from("bids")
            .update({ is_winning: true })
            .eq("id", winningBid.id);

          console.log(`Auction ${auction.id} sold to ${winnerId} for $${winningBid.amount}`);
        } else {
          console.log(`Auction ${auction.id} reserve not met. Reserve: $${auction.reserve_price}, Highest: $${winningBid.amount}`);
        }
      } else {
        console.log(`Auction ${auction.id} ended with no bids`);
      }

      // Update listing status
      const { error: updateError } = await supabase
        .from("listings")
        .update({ status: newStatus })
        .eq("id", auction.id);

      if (updateError) {
        console.error(`Error updating auction ${auction.id}:`, updateError);
        continue;
      }

      results.push({
        auctionId: auction.id,
        title: auction.title,
        status: newStatus,
        winnerId,
        winningAmount: winningBid?.amount || null,
      });
    }

    console.log("Auction finalization complete:", results);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Finalize auctions error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
