import { Router } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  authLimiter,
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
} from "../middleware/rateLimiters.js";
import {
  register,
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";

const router = Router();

const emailRule = body("email")
  .isEmail()
  .withMessage("Valid email is required")
  .normalizeEmail({ gmail_remove_dots: false })
  .isLength({ max: 254 })
  .withMessage("Email too long");

const strongPassword = body("password")
  .isString()
  .isLength({ min: 8, max: 128 })
  .withMessage("Password must be 8-128 characters")
  .matches(/[A-Z]/)
  .withMessage("Password must contain an uppercase letter")
  .matches(/[a-z]/)
  .withMessage("Password must contain a lowercase letter")
  .matches(/[0-9]/)
  .withMessage("Password must contain a digit");

router.post(
  "/register",
  registerLimiter,
  [
    emailRule,
    body("name").isString().trim().isLength({ min: 1, max: 80 }).withMessage("Name is required"),
    strongPassword,
  ],
  validate,
  asyncHandler(register),
);

router.post(
  "/login",
  loginLimiter,
  [emailRule, body("password").isString().isLength({ min: 1, max: 128 })],
  validate,
  asyncHandler(login),
);

router.post("/refresh", authLimiter, asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  [emailRule],
  validate,
  asyncHandler(forgotPassword),
);

router.post(
  "/reset-password",
  authLimiter,
  [body("token").isString().isLength({ min: 10 }), strongPassword],
  validate,
  asyncHandler(resetPassword),
);

router.post(
  "/change-password",
  requireAuth,
  [
    body("currentPassword").isString().isLength({ min: 1, max: 128 }),
    body("newPassword")
      .isString()
      .isLength({ min: 8, max: 128 })
      .withMessage("Password must be 8-128 characters")
      .matches(/[A-Z]/).withMessage("Password must contain an uppercase letter")
      .matches(/[a-z]/).withMessage("Password must contain a lowercase letter")
      .matches(/[0-9]/).withMessage("Password must contain a digit"),
  ],
  validate,
  asyncHandler(changePassword),
);

export default router;
