export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const BadRequest = (code, message, details) =>
  new HttpError(400, code, message, details);
export const Unauthorized = (code = "UNAUTHORIZED", message = "Unauthorized") =>
  new HttpError(401, code, message);
export const Forbidden = (code = "FORBIDDEN", message = "Forbidden") =>
  new HttpError(403, code, message);
export const NotFound = (code = "NOT_FOUND", message = "Not found") =>
  new HttpError(404, code, message);
export const Conflict = (code, message) => new HttpError(409, code, message);
export const TooMany = (code = "TOO_MANY_REQUESTS", message = "Too many requests") =>
  new HttpError(429, code, message);
