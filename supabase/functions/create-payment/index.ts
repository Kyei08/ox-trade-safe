import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { listingId } = await req.json();
    
    if (!listingId) {
      throw new Error("Listing ID is required");
    }

    console.log("Processing payment for listing:", listingId);

    // Get authenticated user (optional for guest checkout)
    const authHeader = req.headers.get("Authorization");
    let user = null;
    let userEmail = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      user = data.user;
      userEmail = user?.email;
      console.log("Authenticated user:", user?.id);
    }

    // Fetch listing details
    const { data: listing, error: listingError } = await supabaseClient
      .from("listings")
      .select("*, profiles!seller_id(full_name)")
      .eq("id", listingId)
      .single();

    if (listingError || !listing) {
      throw new Error("Listing not found");
    }

    console.log("Listing fetched:", listing.title);

    // Determine price based on listing type
    let price;
    if (listing.listing_type === "fixed_price" && listing.fixed_price) {
      price = listing.fixed_price;
    } else if (listing.listing_type === "auction" && listing.current_bid) {
      price = listing.current_bid;
    } else {
      throw new Error("No valid price found for this listing");
    }

    // Convert to cents for Stripe (ZAR uses cents)
    const amountInCents = Math.round(parseFloat(price) * 100);

    console.log("Price calculated:", price, "ZAR, Amount in cents:", amountInCents);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    let customerId;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("Existing customer found:", customerId);
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "zar",
            product_data: {
              name: listing.title,
              description: listing.description?.substring(0, 500),
              images: listing.images?.[0] ? [listing.images[0]] : undefined,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&listing_id=${listingId}`,
      cancel_url: `${req.headers.get("origin")}/listings/${listingId}`,
      metadata: {
        listing_id: listingId,
        seller_id: listing.seller_id,
        buyer_id: user?.id || "guest",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in create-payment:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
