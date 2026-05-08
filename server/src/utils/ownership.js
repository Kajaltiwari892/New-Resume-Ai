import { Forbidden, NotFound } from "./httpError.js";

export function assertOwner(doc, userId) {
  if (!doc) throw NotFound("NOT_FOUND", "Resource not found");
  if (doc.userId.toString() !== userId.toString()) {
    throw Forbidden("NOT_OWNER", "You don't have access to this resource");
  }
  return doc;
}
