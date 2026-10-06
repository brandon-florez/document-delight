import Stripe from "npm:stripe@17";

let stripe: Stripe | undefined;

export function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Falta el secreto STRIPE_SECRET_KEY.");
  stripe ??= new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
  return stripe;
}

export const cryptoProvider = Stripe.createSubtleCryptoProvider();
