import { Unauthorized } from "../utils/httpError.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { User } from "../models/User.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      throw Unauthorized("NO_TOKEN", "Missing access token");
    }
    const token = header.slice(7).trim();
    if (!token) throw Unauthorized("NO_TOKEN", "Missing access token");

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (e) {
      if (e?.name === "TokenExpiredError") {
        throw Unauthorized("TOKEN_EXPIRED", "Access token expired");
      }
      throw Unauthorized("BAD_TOKEN", "Invalid access token");
    }

    const user = await User.findById(payload.sub);
    if (!user) throw Unauthorized("USER_GONE", "User no longer exists");

    // If password changed after the token was issued, invalidate.
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      throw Unauthorized("STALE_TOKEN", "Credentials changed, sign in again");
    }

    req.user = user;
    req.auth = payload;
    next();
  } catch (e) {
    next(e);
  }
}
