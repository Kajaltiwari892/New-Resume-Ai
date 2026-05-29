import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import {
  createCheckout,
  createPortal,
  getBilling,
  verifyCheckout,
} from "../controllers/billingController.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getBilling));
router.get("/verify", asyncHandler(verifyCheckout));
router.post("/checkout", authLimiter, asyncHandler(createCheckout));
router.post("/portal", authLimiter, asyncHandler(createPortal));

export default router;
