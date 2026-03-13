import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const headers = req.headers;

    // 1️⃣ Get validation data from headers
    const transmissionId = headers.get("paypal-transmission-id");
    const transmissionTime = headers.get("paypal-transmission-time");
    const transmissionSig = headers.get("paypal-transmission-sig");
    const certUrl = headers.get("paypal-cert-url");
    const authAlgo = headers.get("paypal-auth-algo");
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (
      !transmissionId ||
      !transmissionTime ||
      !transmissionSig ||
      !certUrl ||
      !authAlgo ||
      !webhookId
    ) {
      console.warn(
        "PayPal Webhook missing validation headers or PAYPAL_WEBHOOK_ID. Verification will likely fail.",
      );
    }

    // 2️⃣ Get access token from PayPal for verification
    const auth = Buffer.from(
      `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_APP_SECRET}`,
    ).toString("base64");
    const paypalUrl = process.env.NEXT_PAYPAL_BASEURL || "https://api-m.paypal.com";

    const tokenRes = await fetch(`${paypalUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      throw new Error("PayPal authentication failed while verifying webhook");
    }

    const { access_token } = await tokenRes.json();

    // 3️⃣ Verify signature (Calling PayPal API)
    const verifyRes = await fetch(
      `${paypalUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          transmission_sig: transmissionSig,
          cert_url: certUrl,
          auth_algo: authAlgo,
          webhook_id: webhookId,
          webhook_event: body,
        }),
      },
    );

    const verifyData = await verifyRes.json();

    if (verifyData.verification_status !== "SUCCESS") {
      console.error("PayPal webhook verification failed:", verifyData);
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Processing PayPal Event:", body.event_type);

    // 4️⃣ Handle specific events
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    switch (body.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const resource = body.resource;
        const internalOrderId = resource.custom_id;
        const transactionId = resource.id;
        const amount = resource.amount.value;

        if (internalOrderId) {
          console.log(
            `Fulfilling order ${internalOrderId} (Transaction: ${transactionId})`,
          );

          const { error } = await supabase.rpc("mark_order_paid", {
            p_order_id: internalOrderId,
            p_payment_gateway: "paypal",
            p_transaction_id: transactionId,
            p_amount_captured: parseFloat(amount),
            p_billing_snapshot: JSON.stringify(resource.payer || {}),
          });

          if (error) {
            console.error("Failed to mark order paid in DB:", error);
          } else {
            console.log("Successfully confirmed payment via webhook");
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.REVERSED":
      case "PAYMENT.CAPTURE.REFUNDED": {
        console.warn(
          `Payment status changed for ${body.resource.custom_id}: ${body.event_type}`,
        );
        break;
      }

      default:
        console.log(`Unhandled PayPal event: ${body.event_type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PayPal Webhook processing error:", error.message);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
