import multer from "multer";
import { env } from "../config/env.js";
import { BadRequest } from "../utils/httpError.js";

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const instance = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploadMaxMb * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) {
      return cb(BadRequest("BAD_FILE_TYPE", "Only PDF or DOCX files are allowed"));
    }
    cb(null, true);
  },
}).single("file");

// Wrapper — convert MulterError into our HttpError shape so the
// frontend gets a clean `{ error: { code, message } }` response.
export function uploadResumeFile(req, res, next) {
  instance(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          BadRequest("FILE_TOO_LARGE", `File exceeds the ${env.uploadMaxMb}MB limit`),
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(BadRequest("BAD_FIELD", "Unexpected file field — use `file`"));
      }
      return next(BadRequest("UPLOAD_ERROR", err.message));
    }
    return next(err);
  });
}
