import ms from "ms";
import { env } from "../config/env.js";

export const REFRESH_COOKIE = "rid";

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: "/api/auth",
    maxAge: ms(env.jwt.refreshTtl),
    signed: false,
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: "/api/auth",
  });
}
