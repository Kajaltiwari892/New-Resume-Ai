import ms from "ms";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
  newJti,
} from "../utils/tokens.js";
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE } from "../utils/cookies.js";
import {
  BadRequest,
  Conflict,
  Unauthorized,
  Forbidden,
} from "../utils/httpError.js";

const MAX_ACTIVE_REFRESH_TOKENS = 10;

async function issueRefreshToken(user, req) {
  const jti = newJti();
  const token = signRefreshToken(user, jti);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ms(env.jwt.refreshTtl));

  // Load with the hidden refreshTokens field.
  const fresh = await User.findById(user._id).select("+refreshTokens");
  if (!fresh) throw Unauthorized("USER_GONE", "User no longer exists");

  // Prune expired / revoked, then keep the newest N.
  const now = Date.now();
  fresh.refreshTokens = fresh.refreshTokens.filter(
    (t) => !t.revokedAt && t.expiresAt.getTime() > now,
  );
  fresh.refreshTokens.push({
    jti,
    tokenHash,
    userAgent: (req.get("user-agent") || "").slice(0, 300),
    ip: req.ip,
    expiresAt,
  });
  if (fresh.refreshTokens.length > MAX_ACTIVE_REFRESH_TOKENS) {
    fresh.refreshTokens = fresh.refreshTokens.slice(-MAX_ACTIVE_REFRESH_TOKENS);
  }
  await fresh.save();

  return token;
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

export async function register(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const name = String(req.body.name || "").trim();

  // Same response shape regardless of whether email exists, but we still need
  // to reject with 409 to let the UI know. Deliberate trade-off: we prefer
  // clear UX over strict enumeration resistance on register (we *do* resist
  // enumeration on login and forgot-password).
  const existing = await User.findOne({ email }).lean();
  if (existing) throw Conflict("EMAIL_IN_USE", "Email is already registered");

  const user = new User({ email, name });
  await user.setPassword(password);
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, req);
  setRefreshCookie(res, refreshToken);

  res.status(201).json({ user: publicUser(user), accessToken });
}

export async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    // Burn some time so timing doesn't enumerate accounts.
    await new Promise((r) => setTimeout(r, 120));
    throw Unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (user.isLocked) {
    throw Forbidden(
      "ACCOUNT_LOCKED",
      `Account temporarily locked. Try again after ${user.lockUntil.toISOString()}`,
    );
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    await user.registerFailedLogin();
    throw Unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }

  await user.registerSuccessfulLogin(req.ip);

  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user, req);
  setRefreshCookie(res, refreshToken);

  res.json({ user: publicUser(user), accessToken });
}

export async function refresh(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw Unauthorized("NO_REFRESH", "Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (e) {
    clearRefreshCookie(res);
    if (e?.name === "TokenExpiredError") {
      throw Unauthorized("REFRESH_EXPIRED", "Refresh token expired");
    }
    throw Unauthorized("BAD_REFRESH", "Invalid refresh token");
  }

  const user = await User.findById(payload.sub).select("+refreshTokens");
  if (!user) {
    clearRefreshCookie(res);
    throw Unauthorized("USER_GONE", "User no longer exists");
  }

  const tokenHash = hashToken(token);
  const record = user.refreshTokens.find(
    (t) => t.jti === payload.jti && t.tokenHash === tokenHash,
  );

  if (!record) {
    // Possible token reuse after rotation — revoke everything as a precaution.
    user.refreshTokens.forEach((t) => {
      if (!t.revokedAt) t.revokedAt = new Date();
    });
    await user.save();
    clearRefreshCookie(res);
    throw Unauthorized("REFRESH_REUSE", "Refresh token reuse detected");
  }

  if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    clearRefreshCookie(res);
    throw Unauthorized("REFRESH_INVALID", "Refresh token is no longer valid");
  }

  // Rotate: revoke the used token, issue a new one.
  record.revokedAt = new Date();
  const newJwtId = newJti();
  record.replacedBy = newJwtId;

  const newRefresh = signRefreshToken(user, newJwtId);
  user.refreshTokens.push({
    jti: newJwtId,
    tokenHash: hashToken(newRefresh),
    userAgent: (req.get("user-agent") || "").slice(0, 300),
    ip: req.ip,
    expiresAt: new Date(Date.now() + ms(env.jwt.refreshTtl)),
  });
  await user.save();

  setRefreshCookie(res, newRefresh);
  const accessToken = signAccessToken(user);
  res.json({ accessToken, user: publicUser(user) });
}

export async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      const user = await User.findById(payload.sub).select("+refreshTokens");
      if (user) {
        const record = user.refreshTokens.find((t) => t.jti === payload.jti);
        if (record && !record.revokedAt) {
          record.revokedAt = new Date();
          await user.save();
        }
      }
    } catch {
      // ignore invalid token — we still clear the cookie below
    }
  }
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function forgotPassword(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();

  // Always return 200 with the same shape to resist enumeration.
  const response = {
    message: "If that email exists, a reset link has been sent",
  };

  const user = await User.findOne({ email }).select(
    "+passwordResetTokenHash +passwordResetExpires",
  );
  if (!user) return res.json(response);

  const rawToken = randomToken(32);
  user.passwordResetTokenHash = hashToken(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  // In production, email the link. For now, log it in dev only.
  if (env.nodeEnv !== "production") {
    console.log(
      `[dev] password reset token for ${email}: ${rawToken} (expires in 30m)`,
    );
  }

  res.json(response);
}

export async function resetPassword(req, res) {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (!token) throw BadRequest("MISSING_TOKEN", "Reset token is required");

  const tokenHash = hashToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select(
    "+passwordHash +refreshTokens +passwordResetTokenHash +passwordResetExpires",
  );

  if (!user) throw BadRequest("BAD_TOKEN", "Reset token is invalid or expired");

  await user.setPassword(password);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  // Invalidate all existing refresh tokens — password changed.
  user.refreshTokens.forEach((t) => {
    if (!t.revokedAt) t.revokedAt = new Date();
  });
  await user.save();

  clearRefreshCookie(res);
  res.json({ message: "Password updated. Please sign in again." });
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");

  const user = await User.findById(req.user._id).select(
    "+passwordHash +refreshTokens",
  );
  const ok = await user.comparePassword(currentPassword);
  if (!ok) throw Unauthorized("INVALID_CREDENTIALS", "Current password is incorrect");

  if (currentPassword === newPassword) {
    throw BadRequest("SAME_PASSWORD", "New password must differ from current");
  }

  await user.setPassword(newPassword);
  // Revoke all refresh tokens except this request (force re-login on other devices).
  user.refreshTokens.forEach((t) => {
    if (!t.revokedAt) t.revokedAt = new Date();
  });
  await user.save();

  clearRefreshCookie(res);
  res.json({ message: "Password changed. Sign in again on other devices." });
}
