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
import { errorHandler, notFound } from "./middleware/errorHandler.js";

const app = express();

// Trust a single proxy hop (Vercel/Render/Railway). Adjust in prod if needed.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
const allowedOrigins = new Set(
  env.clientOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin requests have no Origin header; allow those.
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
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

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[auth] listening on http://localhost:${env.port}`);
  });
}

start();

process.on("unhandledRejection", (err) => {
  // eslint-disable-next-line no-console
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("[uncaughtException]", err);
  process.exit(1);
});
