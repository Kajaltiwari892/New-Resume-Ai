import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { BadRequest } from "../utils/httpError.js";
import { getStripe, primaryOrigin } from "../services/stripe.js";

const FREE = "free";
const PAID_TIERS = ["plus", "pro"];
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

function tierFor(value, fallback = "pro") {
  return PAID_TIERS.includes(value) ? value : fallback;
}

/** Public catalog the pricing page renders prices from (backend is source of truth). */
function tiersCatalog() {
  return {
    free: { amount: 0, name: "Free" },
    plus: { amount: env.stripe.tiers.plus.amount, name: env.stripe.tiers.plus.name },
    pro: { amount: env.stripe.tiers.pro.amount, name: env.stripe.tiers.pro.name },
  };
}

function billingPayload(user) {
  return {
    plan: user.plan || FREE,
    status: user.planStatus || null,
    renewsAt: user.planRenewsAt || null,
    currency: env.stripe.currency,
    tiers: tiersCatalog(),
  };
}

/** GET /api/billing — current plan + price catalog. */
export async function getBilling(req, res) {
  res.json(billingPayload(req.user));
}

/** POST /api/billing/checkout { tier } — start a Stripe Checkout subscription. */
export async function createCheckout(req, res) {
  const stripe = getStripe();
  if (!stripe) {
    throw BadRequest("BILLING_NOT_CONFIGURED", "Payments aren't configured yet.");
  }

  const tier = String(req.body?.tier || "").toLowerCase();
  if (!PAID_TIERS.includes(tier)) {
    throw BadRequest("BAD_TIER", "Choose a valid paid plan.");
  }
  const cfg = env.stripe.tiers[tier];

  // Re-read with the normally-hidden Stripe IDs so we can reuse a customer.
  const user = await User.findById(req.user._id).select(
    "+stripeCustomerId +stripeSubscriptionId",
  );
  const origin = primaryOrigin();
  const userId = user._id.toString();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: userId,
    ...(user.stripeCustomerId
      ? { customer: user.stripeCustomerId }
      : { customer_email: user.email }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.stripe.currency,
          unit_amount: cfg.amount,
          recurring: { interval: "month" },
          product_data: { name: cfg.name },
        },
      },
    ],
    metadata: { userId, tier },
    subscription_data: { metadata: { userId, tier } },
    allow_promotion_codes: true,
    success_url: `${origin}/dashboard?upgraded=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
  });

  res.json({ url: session.url });
}

/** POST /api/billing/portal — open the Stripe customer portal to manage/cancel. */
export async function createPortal(req, res) {
  const stripe = getStripe();
  if (!stripe) {
    throw BadRequest("BILLING_NOT_CONFIGURED", "Payments aren't configured yet.");
  }
  const user = await User.findById(req.user._id).select("+stripeCustomerId");
  if (!user.stripeCustomerId) {
    throw BadRequest("NO_CUSTOMER", "No billing account yet — choose a plan first.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${primaryOrigin()}/pricing`,
  });
  res.json({ url: session.url });
}

/**
 * GET /api/billing/verify?session_id=… — confirm a just-completed Checkout
 * session and apply the purchased tier immediately. Lets the upgrade reflect on
 * return even where webhooks aren't wired up (e.g. local dev).
 */
export async function verifyCheckout(req, res) {
  const stripe = getStripe();
  if (!stripe) {
    throw BadRequest("BILLING_NOT_CONFIGURED", "Payments aren't configured yet.");
  }
  const sessionId = String(req.query.session_id || "").trim();
  if (!sessionId) throw BadRequest("NO_SESSION", "Missing session_id.");

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const belongsToUser =
    session.metadata?.userId === req.user._id.toString() ||
    session.client_reference_id === req.user._id.toString();
  const paid = session.payment_status === "paid" || session.status === "complete";

  if (belongsToUser && paid) {
    const sub = session.subscription;
    await User.findByIdAndUpdate(req.user._id, {
      plan: tierFor(session.metadata?.tier),
      planStatus: typeof sub === "object" ? sub?.status || "active" : "active",
      planRenewsAt:
        typeof sub === "object" && sub?.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null,
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId:
        typeof sub === "object" ? sub?.id : session.subscription || null,
    });
  }

  const fresh = await User.findById(req.user._id);
  res.json({ ...billingPayload(fresh), verified: belongsToUser && paid });
}

// ── Webhook ────────────────────────────────────────────────────────────────

async function findUser({ userId, customerId }) {
  if (userId) {
    const u = await User.findById(userId).select("+stripeCustomerId +stripeSubscriptionId");
    if (u) return u;
  }
  if (customerId) {
    return User.findOne({ stripeCustomerId: customerId }).select(
      "+stripeCustomerId +stripeSubscriptionId",
    );
  }
  return null;
}

/**
 * POST /api/billing/webhook — Stripe event sink. Mounted with a raw body parser
 * in index.js so the signature can be verified. Keeps each user's plan in sync
 * with their subscription lifecycle.
 */
export async function handleWebhook(req, res) {
  const stripe = getStripe();
  if (!stripe || !env.stripe.webhookSecret) {
    return res.status(400).send("Billing not configured");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      env.stripe.webhookSecret,
    );
  } catch (err) {
    console.warn("[stripe] webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const user = await findUser({
          userId: s.metadata?.userId || s.client_reference_id,
          customerId: s.customer,
        });
        if (user) {
          user.plan = tierFor(s.metadata?.tier);
          user.planStatus = "active";
          user.stripeCustomerId = s.customer || user.stripeCustomerId;
          user.stripeSubscriptionId = s.subscription || user.stripeSubscriptionId;
          await user.save();
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const user = await findUser({
          userId: sub.metadata?.userId,
          customerId: sub.customer,
        });
        if (user) {
          user.planStatus = sub.status;
          user.plan = ACTIVE_STATUSES.has(sub.status) ? tierFor(sub.metadata?.tier) : FREE;
          user.planRenewsAt = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null;
          user.stripeCustomerId = sub.customer || user.stripeCustomerId;
          user.stripeSubscriptionId = sub.id;
          await user.save();
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const user = await findUser({
          userId: sub.metadata?.userId,
          customerId: sub.customer,
        });
        if (user) {
          user.plan = FREE;
          user.planStatus = "canceled";
          user.stripeSubscriptionId = null;
          user.planRenewsAt = null;
          await user.save();
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe] webhook handler error:", err);
  }

  res.json({ received: true });
}
