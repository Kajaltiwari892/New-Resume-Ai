"use client";

export const API_BASE =
  process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Access-token in-memory store with sessionStorage persistence ─────────────
// sessionStorage is tab-scoped (cleared when the tab closes) and is NOT
// accessible from other origins, so it is safe for a short-lived JWT.
// The refresh token cookie (HttpOnly, 30 d) handles true long-term sessions;
// we only cache the access token here so that hard-refreshes don't force a
// network round-trip before the page renders.
const SESSION_KEY = "riq_at";

let accessToken: string | null = null;

// Hydrate from sessionStorage synchronously on module load (runs in browser only).
if (typeof window !== "undefined") {
  try {
    accessToken = sessionStorage.getItem(SESSION_KEY) || null;
  } catch {
    /* private-browsing mode may block sessionStorage */
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    try {
      if (token) {
        sessionStorage.setItem(SESSION_KEY, token);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* ignore */
    }
  }
}

type ApiInit = Omit<RequestInit, "body"> & {
  auth?: boolean;
  body?: BodyInit | Record<string, unknown> | null;
  json?: unknown;
  raw?: boolean;
};

function buildHeaders(init: ApiInit): Headers {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (!init.raw && init.json !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  }
  if (init.auth && accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

async function readError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no-op */
  }
  const err = (body as { error?: { code?: string; message?: string; details?: unknown } })
    ?.error;
  return new ApiError(
    res.status,
    err?.code || "UNKNOWN",
    err?.message || res.statusText || "Request failed",
    err?.details,
  );
}

/**
 * Fire a request to the backend, attaching the bearer token when `auth: true`
 * and auto-refreshing it on 401 via the lazy import below.
 */
export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  return doRequest<T>(path, init, /* allowRetry */ true);
}

async function doRequest<T>(path: string, init: ApiInit, allowRetry: boolean): Promise<T> {
  const headers = buildHeaders(init);
  const body =
    init.json !== undefined ? JSON.stringify(init.json) : (init.body as BodyInit | null | undefined);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body,
    credentials: "include",
  });

  if (init.raw) {
    if (!res.ok) throw await readError(res);
    return res as unknown as T;
  }

  if (res.status === 401 && init.auth && allowRetry) {
    const { refresh } = await import("./authClient");
    const token = await refresh();
    if (token) {
      return doRequest<T>(path, init, /* allowRetry */ false);
    }
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) throw await readError(res);

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await res.json()) as T;
  }
  return undefined as T;
}
