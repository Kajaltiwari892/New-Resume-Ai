"use client";

import { api } from "./api";

export type PlanTier = "free" | "plus" | "pro";
export type PaidTier = "plus" | "pro";

export type TierInfo = { amount: number; name: string };

export type Billing = {
  plan: PlanTier;
  status: string | null;
  renewsAt: string | null;
  currency: string;
  tiers: Record<PlanTier, TierInfo>;
  verified?: boolean;
};

export function getBilling() {
  return api<Billing>("/api/billing", { auth: true });
}

/** Creates a Stripe Checkout session for a paid tier and returns its hosted URL. */
export async function startCheckout(tier: PaidTier): Promise<string> {
  const { url } = await api<{ url: string }>("/api/billing/checkout", {
    method: "POST",
    auth: true,
    json: { tier },
  });
  return url;
}

/** Opens the Stripe customer portal (manage / switch / cancel) and returns its URL. */
export async function openBillingPortal(): Promise<string> {
  const { url } = await api<{ url: string }>("/api/billing/portal", {
    method: "POST",
    auth: true,
  });
  return url;
}

/** Confirms a completed checkout by session id (used on return from Stripe). */
export function verifyCheckout(sessionId: string) {
  return api<Billing>(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`, {
    auth: true,
  });
}

/** "₹499" style label from a smallest-unit amount + currency. */
export function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(0)} ${currency.toUpperCase()}`;
  }
}
