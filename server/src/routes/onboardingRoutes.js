import { Router } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { authLimiter } from "../middleware/rateLimiters.js";
import {
  getOnboarding,
  saveOnboarding,
} from "../controllers/onboardingController.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(getOnboarding));

router.put(
  "/",
  authLimiter,
  [
    body("fullName").optional().isString().isLength({ max: 120 }),
    body("jobTitle").optional().isString().isLength({ max: 120 }),
    body("experienceLevel")
      .optional()
      .isIn(["Fresher", "1-3 yrs", "3-7 yrs", "7+ yrs", ""]),
    body("industry").optional().isString().isLength({ max: 80 }),
    body("targetRole").optional().isString().isLength({ max: 120 }),
    body("dreamCompanies").optional().isArray({ max: 20 }),
    body("careerSwitch").optional().isBoolean(),
    body("previousField").optional().isString().isLength({ max: 120 }),
    body("resumeType")
      .optional()
      .isIn(["Chronological", "Functional", "Hybrid", ""]),
    body("priorities").optional().isArray({ max: 12 }),
    body("primaryGoal")
      .optional()
      .isIn([
        "Get more interviews",
        "Switch careers",
        "Land first job",
        "Improve resume quality",
        "",
      ]),
  ],
  validate,
  asyncHandler(saveOnboarding),
);

export default router;
