import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name, fallback) {
  const v = process.env[name];
  return v && v.trim() ? v : fallback;
}

function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "true" || v === "1";
}

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer`);
  return n;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: int("PORT", 4000),
  clientOrigin: optional("CLIENT_ORIGIN", "http://localhost:3000"),

  mongoUri: required("MONGODB_URI"),

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: optional("JWT_ACCESS_TTL", "15m"),
    refreshTtl: optional("JWT_REFRESH_TTL", "30d"),
  },

  cookie: {
    secure: bool("COOKIE_SECURE", false),
    sameSite: optional("COOKIE_SAMESITE", "lax"),
    domain: optional("COOKIE_DOMAIN", undefined),
  },

  bcryptRounds: int("BCRYPT_ROUNDS", 12),
  loginMaxAttempts: int("LOGIN_MAX_ATTEMPTS", 5),
  loginLockMinutes: int("LOGIN_LOCK_MINUTES", 15),

  uploadMaxMb: int("UPLOAD_MAX_MB", 5),

  gemini: {
    apiKey: optional("GEMINI_API_KEY", ""),
    model: optional("GEMINI_MODEL", "gemini-2.5-flash"),
  },
};

if (env.jwt.accessSecret === env.jwt.refreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
}
if (env.jwt.accessSecret.length < 32 || env.jwt.refreshSecret.length < 32) {
  throw new Error("JWT secrets must be at least 32 characters");
}
