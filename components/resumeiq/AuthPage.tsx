"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FiArrowRight, FiCheck, FiLoader, FiX } from "react-icons/fi";
import {
  AuthError,
  login as loginRequest,
  register as registerRequest,
} from "@/lib/authClient";
import { ToastStack, useToasts, type ToastKind } from "./Toast";

type Mode = "login" | "register";

type ValidationDetail = { field?: string; message?: string };

const PASSWORD_RULES: { test: (pw: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
];

function mapAuthError(err: AuthError, mode: Mode): {
  kind: ToastKind;
  title: string;
  message?: string;
} {
  switch (err.code) {
    case "VALIDATION_ERROR": {
      const details = (err.details as ValidationDetail[] | undefined) ?? [];
      const first = details[0];
      if (first?.message) {
        return {
          kind: "error",
          title: first.field ? `Check your ${first.field}` : "Check your details",
          message: first.message,
        };
      }
      return { kind: "error", title: "Please check the fields and try again." };
    }
    case "EMAIL_IN_USE":
      return {
        kind: "warning",
        title: "Email already registered",
        message: "Try signing in instead — or use a different email.",
      };
    case "INVALID_CREDENTIALS":
      return {
        kind: "error",
        title: "Email or password is incorrect",
        message:
          mode === "login"
            ? "Double-check your password. New here? Create an account below."
            : "Invalid credentials.",
      };
    case "ACCOUNT_LOCKED":
      return {
        kind: "warning",
        title: "Account temporarily locked",
        message: "Too many failed attempts. Try again in a few minutes.",
      };
    case "TOO_MANY_REQUESTS":
      return {
        kind: "warning",
        title: "Slow down a moment",
        message: "Too many requests from this device. Try again shortly.",
      };
    default:
      return {
        kind: "error",
        title: "Something went wrong",
        message: err.message || "Please try again.",
      };
  }
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((r) => ({ label: r.label, ok: r.test(password) })),
    [password],
  );
  const passwordValid = passwordStatus.every((s) => s.ok);

  function switchMode(next: Mode) {
    setMode(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    if (mode === "register" && !passwordValid) {
      const missing = passwordStatus.filter((s) => !s.ok).map((s) => s.label);
      push({
        kind: "error",
        title: "Password doesn't meet the requirements",
        message: missing.join(" · "),
      });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerRequest({ email, name, password });
        push({
          kind: "success",
          title: "Welcome aboard!",
          message: "Redirecting to your dashboard…",
          duration: 2000,
        });
      } else {
        await loginRequest({ email, password });
        push({
          kind: "success",
          title: "Signed in",
          message: "Taking you to your dashboard…",
          duration: 2000,
        });
      }
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof AuthError) {
        push(mapAuthError(err, mode));
      } else {
        push({
          kind: "error",
          title: "Network error",
          message:
            err instanceof Error
              ? err.message
              : "Couldn't reach the server. Check your connection and try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="ambient-grid" />
      <section className="auth-copy">
        <Link className="auth-brand" href="/">
          <span />
          ResumeIQ
        </Link>
        <h1>Elevate your career with AI.</h1>
        <p>
          Join the executive suite. Use mathematical precision and AI-driven
          insights to craft resumes that land interviews at world-class
          companies.
        </p>
        <div className="auth-stats">
          <article>
            <strong>500k+</strong>
            <span>Resumes Analyzed</span>
          </article>
          <article>
            <strong>94%</strong>
            <span>Interview Rate</span>
          </article>
        </div>
      </section>

      <section className="auth-card" aria-label="Authentication form">
        <header>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>
            {mode === "login"
              ? "Please enter your details to continue"
              : "Start building a resume recruiters actually read"}
          </p>
        </header>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Log In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate>
          {mode === "register" && (
            <label>
              Full Name
              <input
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </label>
          )}
          <label>
            Email Address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </label>
          <label>
            <span className="password-label">
              Password
              {mode === "login" && (
                <Link href="#" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </Link>
              )}
            </span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "register"
                  ? "8+ chars, upper, lower, number"
                  : "Your password"
              }
              aria-describedby={mode === "register" ? "password-rules" : undefined}
            />
          </label>

          {mode === "register" && password.length > 0 && (
            <ul id="password-rules" className="password-rules" aria-label="Password requirements">
              {passwordStatus.map((rule) => (
                <li key={rule.label} className={rule.ok ? "ok" : "pending"}>
                  {rule.ok ? <FiCheck size={14} /> : <FiX size={14} />}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
            style={{ opacity: submitting ? 0.75 : 1 }}
          >
            {submitting ? (
              <>
                <FiLoader
                  size={18}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                Please wait
              </>
            ) : (
              <>
                {mode === "login" ? "Sign In" : "Create Account"}
                <FiArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <p className="auth-footnote">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  switchMode("register");
                }}
              >
                Start Your Journey
              </Link>
            </>
          ) : (
            <>
              Already have one?{" "}
              <Link
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  switchMode("login");
                }}
              >
                Log in
              </Link>
            </>
          )}
        </p>
      </section>

      <div className="engine-status">
        <span />
        AI Engine Online
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
