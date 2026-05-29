"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import {
  type Billing,
  type PaidTier,
  type PlanTier,
  formatPrice,
  getBilling,
  openBillingPortal,
  startCheckout,
} from "@/lib/billingClient";

type Tier = {
  id: PlanTier;
  name: string;
  tagline: string;
  features: string[];
  highlight?: boolean;
};

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline:
      "Test the waters. Everything you need for a single, honest look at where your resume stands today.",
    features: [
      "1 resume analysis",
      "Core ATS score & letter grade",
      "A handful of improvement suggestions",
      "1 interview question set",
      "Your most recent scan saved",
    ],
  },
  {
    id: "plus",
    name: "Plus",
    tagline:
      "For active job seekers who want sharper, repeatable feedback while applying to roles week after week.",
    features: [
      "Unlimited ATS scans & re-analysis",
      "AI rewrite suggestions on every bullet",
      "5 tailored interview sets each month",
      "Line-by-line error detection",
      "Full scan history",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    highlight: true,
    tagline:
      "Everything, with no limits. Built for people who are serious about landing the offer at their dream company.",
    features: [
      "Everything in Plus",
      "Unlimited AI rewrites",
      "Unlimited interview question sets",
      "Priority analysis — skip the queue",
      "Dream-company tailoring & red-flag checks",
    ],
  },
];

const FALLBACK_AMOUNT: Record<PlanTier, number> = { free: 0, plus: 19900, pro: 49900 };

export default function PricingPage() {
  const { user, checked } = useRequireAuth();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!user) return;
    getBilling()
      .then(setBilling)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") {
      setCancelled(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const currentPlan: PlanTier = billing?.plan ?? user?.plan ?? "free";
  const currency = billing?.currency ?? "inr";

  function priceLabel(id: PlanTier) {
    const amount = billing?.tiers?.[id]?.amount ?? FALLBACK_AMOUNT[id];
    return formatPrice(amount, currency);
  }

  function cta(tier: Tier): { label: string; disabled: boolean } {
    if (tier.id === currentPlan) return { label: "Current plan", disabled: true };
    if (tier.id === "free") return { label: "Downgrade", disabled: false };
    if (currentPlan === "free") return { label: `Choose ${tier.name}`, disabled: false };
    return { label: "Switch plan", disabled: false };
  }

  async function handle(tier: Tier) {
    if (tier.id === currentPlan) return;
    setError(null);
    setBusy(tier.id);
    try {
      // Free users buying a paid tier go through Checkout; anyone already on a
      // paid plan (downgrade / switch / cancel) goes through the Stripe portal.
      const url =
        tier.id !== "free" && currentPlan === "free"
          ? await startCheckout(tier.id as PaidTier)
          : await openBillingPortal();
      window.location.href = url;
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} title="Plans & pricing" subtitle="Upgrade your job search">
      <div className="w-full max-w-5xl px-4 pb-20 pt-2 sm:px-8">
        {/* Intro */}
        <div className="mb-8 max-w-2xl">
          <p className="text-sm leading-relaxed text-neutral-300">
            Simple pricing that scales with your search. Start free, and upgrade only when you
            want unlimited rewrites and interview prep. Every paid plan is billed monthly — no
            contracts, no hidden fees, and you can cancel anytime.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">
            Prices are in Indian Rupees and include everything listed on each plan. Payments are
            processed securely by Stripe — we never see or store your card details.
          </p>
        </div>

        {cancelled && (
          <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Checkout cancelled — no charge was made. You can pick a plan whenever you&apos;re ready.
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Tiers */}
        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((tier) => {
            const action = cta(tier);
            const isCurrent = tier.id === currentPlan;
            const loading = busy === tier.id;
            return (
              <section
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border bg-neutral-950 p-6 ${
                  tier.highlight
                    ? "border-violet-500/50 ring-1 ring-violet-500/30"
                    : "border-neutral-800"
                }`}
              >
                {tier.highlight && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Sparkles size={12} /> Most popular
                  </span>
                )}

                <h2 className="text-base font-semibold text-white">{tier.name}</h2>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-white">{priceLabel(tier.id)}</span>
                  <span className="text-sm text-neutral-500">
                    {tier.id === "free" ? "forever" : "/ month"}
                  </span>
                </div>
                <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-neutral-400">
                  {tier.tagline}
                </p>

                <button
                  type="button"
                  onClick={() => handle(tier)}
                  disabled={action.disabled || loading}
                  className={`mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed ${
                    tier.highlight
                      ? "bg-white text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
                      : "border border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900 disabled:opacity-50"
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Opening…
                    </>
                  ) : isCurrent ? (
                    <>
                      <Check size={15} /> Current plan
                    </>
                  ) : (
                    action.label
                  )}
                </button>

                <ul className="mt-6 space-y-2.5 border-t border-neutral-900 pt-5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-300">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
                        <Check size={12} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Why upgrade */}
        <div className="mt-12 grid gap-8 border-t border-neutral-900 pt-10 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-white">Why upgrade?</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              The free plan is great for a one-off check — but real job searches are iterative.
              You tweak a bullet, re-scan, tailor for a new role, and prep for interviews over
              weeks. Plus and Pro remove the limits so you can keep refining until your resume
              actually earns callbacks, instead of rationing your scans.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Billing, simply put</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              You&apos;re charged monthly and nothing more — cancel in two clicks from the billing
              portal and you keep access until the period ends. Switching plans is prorated
              automatically. Need an invoice or to update your card? It&apos;s all in the same
              secure Stripe portal.
            </p>
          </div>
        </div>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-xs text-neutral-500">
          <ShieldCheck size={14} />
          Secure checkout by Stripe · billed monthly · cancel anytime
        </p>
      </div>
    </SidebarShell>
  );
}
