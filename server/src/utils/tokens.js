import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, name: user.name },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl, issuer: "resumeiq", audience: "resumeiq-web" },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret, {
    issuer: "resumeiq",
    audience: "resumeiq-web",
  });
}

export function signRefreshToken(user, jti) {
  return jwt.sign({ sub: user._id.toString(), jti }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
    issuer: "resumeiq",
    audience: "resumeiq-web",
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret, {
    issuer: "resumeiq",
    audience: "resumeiq-web",
  });
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function newJti() {
  return crypto.randomUUID();
}
