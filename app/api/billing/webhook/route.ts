import { stripeClient } from "@/lib/server/stripe";
import { processStripeEvent } from "@/lib/server/billing";
import { readBody } from "@/lib/server/upload";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY)
    return new Response("Webhook not configured", { status: 503 });
  let event;
  try {
    const body = await readBody(request, 512000);
    event = stripeClient().webhooks.constructEvent(
      body,
      request.headers.get("stripe-signature") || "",
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
  try {
    await processStripeEvent(event);
    return Response.json({ received: true });
  } catch {
    // Non-2xx asks Stripe to retry. Invoice grants are idempotent across event IDs too.
    console.error(
      "EditingApp billing webhook requires retry",
      event.type,
      event.id,
    );
    return new Response("Unable to apply billing event", { status: 500 });
  }
}
