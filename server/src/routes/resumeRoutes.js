import { Router } from "express";
import { body } from "express-validator";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { uploadResumeFile } from "../middleware/upload.js";
import { aiLimiter, uploadLimiter } from "../middleware/rateLimiters.js";
import {
  listResumes,
  createResumeFromText,
  uploadResume,
  getResume,
  patchResume,
  deleteResume,
  analyzeResumeHandler,
  getLatestAnalysis,
  generateSuggestionsHandler,
  listSuggestions,
  applySuggestion,
  applyAllSuggestions,
  generateInterviewHandler,
  listInterviewQuestions,
  matchKeywordsHandler,
  exportResumePdf,
} from "../controllers/resumeController.js";

const router = Router();

router.use(requireAuth);

router.get("/", asyncHandler(listResumes));

router.post(
  "/",
  [
    body("name").optional().isString().isLength({ max: 200 }),
    body("text").isString().isLength({ min: 50, max: 50000 }),
  ],
  validate,
  asyncHandler(createResumeFromText),
);

router.post("/upload", uploadLimiter, uploadResumeFile, asyncHandler(uploadResume));

router.get("/:id", asyncHandler(getResume));
router.patch(
  "/:id",
  [
    body("name").optional().isString().isLength({ max: 200 }),
    body("summary").optional().isString().isLength({ max: 20000 }),
    body("experience").optional().isString().isLength({ max: 50000 }),
    body("skills").optional().isString().isLength({ max: 10000 }),
    body("education").optional().isString().isLength({ max: 20000 }),
  ],
  validate,
  asyncHandler(patchResume),
);
router.delete("/:id", asyncHandler(deleteResume));

router.post("/:id/analyze", aiLimiter, asyncHandler(analyzeResumeHandler));
router.get("/:id/analysis", asyncHandler(getLatestAnalysis));

router.post("/:id/suggestions", aiLimiter, asyncHandler(generateSuggestionsHandler));
router.get("/:id/suggestions", asyncHandler(listSuggestions));
router.post("/:id/suggestions/:sid/apply", asyncHandler(applySuggestion));
router.post("/:id/suggestions/apply-all", asyncHandler(applyAllSuggestions));

router.post("/:id/interview", aiLimiter, asyncHandler(generateInterviewHandler));
router.get("/:id/interview", asyncHandler(listInterviewQuestions));

router.post(
  "/:id/keywords",
  aiLimiter,
  [body("jobDescription").isString().isLength({ min: 30, max: 20000 })],
  validate,
  asyncHandler(matchKeywordsHandler),
);

router.get("/:id/export", asyncHandler(exportResumePdf));

export default router;
