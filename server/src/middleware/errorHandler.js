import { HttpError } from "../utils/httpError.js";

export function notFound(_req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
}

export function errorHandler(err, req, res, _next) {
  void _next;

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err?.name === "ValidationError") {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: err.message },
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      error: { code: "DUPLICATE_KEY", message: "Resource already exists" },
    });
  }

  console.error("[unhandled]", err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
