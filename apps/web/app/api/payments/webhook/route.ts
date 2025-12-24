import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });

    const body = await request.text();
    const headersList = headers();
    const sig = headersList?.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createClient();

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase,
        );
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
          supabase,
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
          supabase,
        );
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: any,
) {
  const quoteId = session.metadata?.quote_id;
  const organizationId = session.metadata?.organization_id;

  if (!quoteId || !organizationId) {
    console.error("Missing metadata in checkout session");
    return;
  }

  // Use idempotency key to prevent duplicate processing
  // const idempotencyKey = session.id;

  // Check if order already exists
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("quote_id", quoteId)
    .eq("organization_id", organizationId)
    .single();

  if (existingOrder) {
    console.log("Order already exists for quote:", quoteId);
    return;
  }

  // Fetch quote details
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      `
      *,
      lines:quote_lines(*),
      selected_lead_option:lead_options(*)
    `,
    )
    .eq("id", quoteId)
    .eq("organization_id", organizationId)
    .single();

  if (!quote) {
    console.error("Quote not found:", quoteId);
    return;
  }

  // Create order
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      id: `order_${Date.now()}`,
      quote_id: quoteId,
      organization_id: organizationId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      amount: session.amount_total,
      currency: session.currency,
      status: "confirmed",
      billing_info: {
        email: session.customer_details?.email,
        name: session.customer_details?.name,
        phone: session.customer_details?.phone,
        address: session.customer_details?.address,
      },
      shipping_info: session.shipping_details,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orderError) {
    console.error("Failed to create order:", orderError);
    return;
  }

  // Update quote status
  await supabase
    .from("quotes")
    .update({
      status: "Ordered",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId)
    .eq("organization_id", organizationId);

  // Update checkout session status
  await supabase
    .from("checkout_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  // Log analytics events
  await supabase.from("analytics_events").insert([
    {
      event_type: "payment_succeeded",
      quote_id: quoteId,
      organization_id: organizationId,
      properties: {
        amount: session.amount_total,
        currency: session.currency,
        order_id: order.id,
      },
      created_at: new Date().toISOString(),
    },
    {
      event_type: "order_created",
      quote_id: quoteId,
      organization_id: organizationId,
      properties: {
        order_id: order.id,
        amount: session.amount_total,
        currency: session.currency,
        line_count: quote.lines.length,
      },
      created_at: new Date().toISOString(),
    },
  ]);

  // Send confirmation email (would be implemented with email service)
  console.log("Order created successfully:", order.id);
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  // supabase: any,
) {
  const quoteId = paymentIntent.metadata?.quote_id;
  const organizationId = paymentIntent.metadata?.organization_id;

  if (!quoteId || !organizationId) return;

  // Additional processing if needed
  console.log("Payment intent succeeded:", paymentIntent.id);
}

async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  supabase: any,
) {
  const quoteId = paymentIntent.metadata?.quote_id;
  const organizationId = paymentIntent.metadata?.organization_id;

  if (!quoteId || !organizationId) return;

  // Update checkout session status
  await supabase
    .from("checkout_sessions")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", paymentIntent.id);

  // Log failed payment
  await supabase.from("analytics_events").insert({
    event_type: "payment_failed",
    quote_id: quoteId,
    organization_id: organizationId,
    properties: {
      payment_intent_id: paymentIntent.id,
      failure_code: paymentIntent.last_payment_error?.code,
      failure_message: paymentIntent.last_payment_error?.message,
    },
    created_at: new Date().toISOString(),
  });

  console.log("Payment intent failed:", paymentIntent.id);
}
