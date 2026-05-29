import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import onboardingRoutes from "./routes/onboardingRoutes.js";
import resumeRoutes from "./routes/resumeRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import { handleWebhook } from "./controllers/billingController.js";
import { asyncHandler } from "./middleware/asyncHandler.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

// Trust a single proxy hop (Vercel/Render/Railway). Adjust in prod if needed.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = new Set(
  env.clientOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const isDev = env.nodeEnv !== "production";

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin requests have no Origin header; allow those.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      // Dev convenience: allow any localhost / 127.0.0.1 port.
      if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      console.warn(`[cors] blocked origin: ${origin}`);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Stripe webhook needs the raw body for signature verification, so it MUST be
// registered before the JSON body parser below.
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(handleWebhook),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(hpp());

if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/billing", billingRoutes);

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`[auth] listening on http://localhost:${env.port}`);
  });
}

start();

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});
