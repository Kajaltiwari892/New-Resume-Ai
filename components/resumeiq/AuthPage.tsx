"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiCheck, FiEye, FiEyeOff, FiLoader, FiX } from "react-icons/fi";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import BrandMark from "./BrandMark";
import {
  AuthError,
  bootstrapSession,
  login as loginRequest,
  register as registerRequest,
} from "@/lib/authClient";
import { getOnboarding } from "@/lib/resumeClient";
import { ToastStack, useToasts, type ToastKind } from "./Toast";

async function destinationAfterAuth(): Promise<"/dashboard" | "/onboarding"> {
  try {
    const { profile } = await getOnboarding();
    return profile?.onboardingCompleted ? "/dashboard" : "/onboarding";
  } catch {
    return "/onboarding";
  }
}

type Mode = "login" | "register";
type ValidationDetail = { field?: string; message?: string };

const PASSWORD_RULES: { test: (pw: string) => boolean; label: string }[] = [
  { test: (p) => p.length >= 8, label: "At least 8 characters" },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p) => /[0-9]/.test(p), label: "One number" },
];

function mapAuthError(err: AuthError, mode: Mode): { kind: ToastKind; title: string; message?: string } {
  switch (err.code) {
    case "VALIDATION_ERROR": {
      const details = (err.details as ValidationDetail[] | undefined) ?? [];
      const first = details[0];
      if (first?.message) {
        return { kind: "error", title: first.field ? `Check your ${first.field}` : "Check your details", message: first.message };
      }
      return { kind: "error", title: "Please check the fields and try again." };
    }
    case "EMAIL_IN_USE":
      return { kind: "warning", title: "Email already registered", message: "Try signing in instead — or use a different email." };
    case "INVALID_CREDENTIALS":
      return { kind: "error", title: "Email or password is incorrect", message: mode === "login" ? "Double-check your password. New here? Create an account below." : "Invalid credentials." };
    case "ACCOUNT_LOCKED":
      return { kind: "warning", title: "Account temporarily locked", message: "Too many failed attempts. Try again in a few minutes." };
    case "TOO_MANY_REQUESTS":
      return { kind: "warning", title: "Slow down a moment", message: "Too many requests from this device. Try again shortly." };
    default:
      return { kind: "error", title: "Something went wrong", message: err.message || "Please try again." };
  }
}

/* ── Aceternity bottom-gradient hover effect ──────────────────────────── */
const BottomGradient = () => (
  <>
    <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
    <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
  </>
);

/* ── Field wrapper ──────────────────────────────────────────────────────── */
const Field = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex w-full flex-col space-y-2", className)}>{children}</div>
);

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toasts, push, dismiss } = useToasts();

  // If already signed in, send them to wherever they belong.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await bootstrapSession();
      if (cancelled || !user) return;
      router.replace(await destinationAfterAuth());
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const passwordStatus = useMemo(
    () => PASSWORD_RULES.map((r) => ({ label: r.label, ok: r.test(password) })),
    [password],
  );
  const passwordValid = passwordStatus.every((s) => s.ok);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (mode === "register" && !passwordValid) {
      push({ kind: "error", title: "Password requirements not met", message: passwordStatus.filter((s) => !s.ok).map((s) => s.label).join(" · ") });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerRequest({ email, name, password });
        push({ kind: "success", title: "Welcome aboard!", message: "Just a couple quick questions…", duration: 2000 });
        router.push("/onboarding");
      } else {
        await loginRequest({ email, password });
        const dest = await destinationAfterAuth();
        push({ kind: "success", title: "Signed in", message: dest === "/dashboard" ? "Taking you to your dashboard…" : "Finishing your setup…", duration: 2000 });
        router.push(dest);
      }
    } catch (err) {
      if (err instanceof AuthError) push(mapAuthError(err, mode));
      else push({ kind: "error", title: "Network error", message: err instanceof Error ? err.message : "Couldn't reach the server." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell-v2">
      {/* Dark ambient background */}
      <div className="auth-bg-grid" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-1" aria-hidden />
      <div className="auth-bg-blob auth-bg-blob-2" aria-hidden />

      {/* ── Reverb-style pill nav ── */}
      <header className="lp-nav-wrap" style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30 }}>
        <nav className="lp-nav">
          <BrandMark />
          <div className="lp-nav-center" />
          <div className="lp-nav-right">
            <Link href="/auth" className="lp-nav-signin">Sign in</Link>
            <Link href="/auth" className="lp-nav-get-started">Get started</Link>
          </div>
        </nav>
      </header>

      {/* ── Auth card (Aceternity style) ── */}
      <section className="auth-card-v2" aria-label="Authentication">
        {/* Header */}
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-white">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            {mode === "login"
              ? "Sign in to your ResumeIQ workspace"
              : "Start building a resume recruiters actually read"}
          </p>
        </div>

        {/* Mode toggle tabs */}
        <div className="auth-tabs-v2" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Log In
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {mode === "register" && (
            <Field>
              <Label htmlFor="auth-name">Full Name</Label>
              <Input
                id="auth-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </Field>
          )}

          <Field>
            <Label htmlFor="auth-email">Email Address</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {mode === "login" && (
                <Link href="#" onClick={(e) => e.preventDefault()} className="text-xs text-neutral-400 hover:text-white transition-colors">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "8+ chars, upper, lower, number" : "Your password"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:text-white transition-colors"
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </Field>

          {/* Password rules */}
          {mode === "register" && password.length > 0 && (
            <ul className="password-rules" aria-label="Password requirements">
              {passwordStatus.map((rule) => (
                <li key={rule.label} className={rule.ok ? "ok" : "pending"}>
                  {rule.ok ? <FiCheck size={13} /> : <FiX size={13} />}
                  <span>{rule.label}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Submit — Aceternity gradient style */}
          <button
            type="submit"
            disabled={submitting}
            className="group/btn relative mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-800 font-semibold text-white shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] transition duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontSize: "0.95rem" }}
          >
            {submitting ? (
              <><FiLoader size={17} style={{ animation: "spin 1s linear infinite" }} /> Please wait</>
            ) : (
              <>{mode === "login" ? "Sign In" : "Create Account"} →</>
            )}
            <BottomGradient />
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />

        {/* Footnote */}
        <p className="text-center text-sm text-neutral-500">
          {mode === "login" ? (
            <>Don&apos;t have an account?{" "}
              <button type="button" onClick={() => setMode("register")} className="text-neutral-300 underline underline-offset-4 hover:text-white transition-colors">
                Create one
              </button>
            </>
          ) : (
            <>Already have one?{" "}
              <button type="button" onClick={() => setMode("login")} className="text-neutral-300 underline underline-offset-4 hover:text-white transition-colors">
                Log in
              </button>
            </>
          )}
        </p>

        {/* AI engine badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-600">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
          AI Engine Online
        </div>
      </section>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
