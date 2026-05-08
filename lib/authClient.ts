"use client";

import { api, ApiError, getAccessToken, setAccessToken } from "./api";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  emailVerified: boolean;
};

type AuthResponse = { user: PublicUser; accessToken: string };

export { ApiError as AuthError, getAccessToken, setAccessToken };

let refreshPromise: Promise<string | null> | null = null;

export async function register(input: { email: string; name: string; password: string }) {
  const data = await api<AuthResponse>("/api/auth/register", {
    method: "POST",
    json: input,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function login(input: { email: string; password: string }) {
  const data = await api<AuthResponse>("/api/auth/login", {
    method: "POST",
    json: input,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function refresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await api<AuthResponse>("/api/auth/refresh", { method: "POST" });
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function logout() {
  try {
    await api<void>("/api/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

export async function me(): Promise<PublicUser | null> {
  try {
    const data = await api<{ user: PublicUser }>("/api/auth/me", { auth: true });
    return data.user;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const token = await refresh();
      if (!token) return null;
      const data = await api<{ user: PublicUser }>("/api/auth/me", { auth: true });
      return data.user;
    }
    throw e;
  }
}

export async function forgotPassword(email: string) {
  return api<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    json: { email },
  });
}

export async function resetPassword(token: string, password: string) {
  return api<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    json: { token, password },
  });
}

// Boot-time session probe: tries a silent refresh and returns the user if any.
export async function bootstrapSession(): Promise<PublicUser | null> {
  if (getAccessToken()) {
    return me();
  }
  const token = await refresh();
  if (!token) return null;
  return me();
}
