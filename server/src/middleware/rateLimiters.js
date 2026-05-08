import rateLimit from "express-rate-limit";

const baseOptions = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Too many requests" },
  },
};

// Generic wrapper: any auth endpoint is limited per-IP.
export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 60,
});

// Tighter for password-guessing surfaces.
export const loginLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
});

export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 20,
});

export const forgotPasswordLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
});

// Upload / AI endpoints are expensive — limit per user + IP.
export const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 30,
});

export const aiLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  max: 60,
});
