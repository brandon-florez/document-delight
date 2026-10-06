// POST /functions/v1/stripe-webhook
// Configurar en Stripe con el evento checkout.session.completed.
// Marca como Paid la factura cuyo external_id es el Payment Link pagado.
import { problem } from "../_shared/http.ts";
import { cryptoProvider, getStripe } from "../_shared/stripe.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return problem(405, "Method Not Allowed");

  const signature = req.headers.get("Stripe-Signature");
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !secret) return problem(400, "Bad Request", "Falta la firma de Stripe.");

  const payload = await req.text();
  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      payload,
      signature,
      secret,
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    console.error("invalid stripe signature", error);
    return problem(400, "Bad Request", "Firma de Stripe inválida.");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentLinkId =
      typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;

    if (paymentLinkId && session.payment_status === "paid") {
      const { error } = await getAdminClient()
        .from("invoices")
        .update({ status: "Paid", paid_at: new Date().toISOString() })
        .eq("external_id", paymentLinkId)
        .eq("status", "Sent");
      if (error) {
        console.error("could not mark invoice as paid", error);
        return problem(500, "Internal Server Error");
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
