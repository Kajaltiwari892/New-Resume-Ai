import { validationResult } from "express-validator";
import { BadRequest } from "../utils/httpError.js";

export function validate(req, _res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));
  next(BadRequest("VALIDATION_ERROR", "Invalid request", details));
}
