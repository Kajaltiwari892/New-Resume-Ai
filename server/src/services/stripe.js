import Stripe from "stripe";
import { env } from "../config/env.js";

let client = null;

/**
 * Returns a memoized Stripe client, or null when no secret key is configured.
 * Callers should treat null as "billing not set up" and respond accordingly.
 */
export function getStripe() {
  if (!env.stripe.secretKey) return null;
  if (!client) client = new Stripe(env.stripe.secretKey);
  return client;
}

export function billingConfigured() {
  return Boolean(env.stripe.secretKey);
}

/** First configured client origin (CLIENT_ORIGIN may be a comma-separated list). */
export function primaryOrigin() {
  return env.clientOrigin.split(",")[0].trim().replace(/\/$/, "");
}
