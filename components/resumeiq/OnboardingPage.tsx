"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSession } from "@/lib/authClient";
import {
  analyzeResume,
  createResumeFromText,
  getOnboarding,
  saveOnboarding,
  uploadResume,
  type ExperienceLevel,
  type PrimaryGoal,
} from "@/lib/resumeClient";
import { ToastStack, useToasts } from "./Toast";
import { ApiError } from "@/lib/api";

const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string; sub: string }[] = [
  { value: "Fresher", label: "Entry Level", sub: "0–1 yrs / student / first job" },
  { value: "1-3 yrs", label: "Intermediate", sub: "1–5 yrs experience" },
  { value: "7+ yrs", label: "Senior", sub: "5+ yrs / lead / staff" },
];

const GOAL_OPTIONS: { value: PrimaryGoal; label: string }[] = [
  { value: "Get more interviews", label: "Get more interviews" },
  { value: "Switch careers", label: "Switch careers" },
  { value: "Land first job", label: "Land my first job" },
  { value: "Improve resume quality", label: "Improve my resume quality" },
];

type UploadTab = "file" | "paste";

export default function OnboardingPage() {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  const [checking, setChecking] = useState(true);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | "">("");
  const [targetRole, setTargetRole] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | "">("");

  // upload section
  const [uploadTab, setUploadTab] = useState<UploadTab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await bootstrapSession();
      if (cancelled) return;
      if (!user) {
        router.replace("/auth");
        return;
      }
      try {
        const { profile } = await getOnboarding();
        if (cancelled) return;
        if (profile?.onboardingCompleted) {
          router.replace("/dashboard");
          return;
        }
        if (profile?.experienceLevel) setExperienceLevel(profile.experienceLevel);
        if (profile?.targetRole) setTargetRole(profile.targetRole);
        if (profile?.primaryGoal) setPrimaryGoal(profile.primaryGoal);
      } catch {
        /* fresh user */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const profileValid =
    Boolean(experienceLevel) &&
    targetRole.trim().length >= 2 &&
    Boolean(primaryGoal);

  const hasUpload =
    (uploadTab === "file" && file) ||
    (uploadTab === "paste" && pastedText.trim().length >= 50);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profileValid || submitting) return;
    setSubmitting(true);
    setSubmitStatus("Saving your details…");
    try {
      await saveOnboarding({
        experienceLevel: experienceLevel as ExperienceLevel,
        targetRole: targetRole.trim(),
        primaryGoal: primaryGoal as PrimaryGoal,
      });

      if (hasUpload) {
        setSubmitStatus("Uploading your resume…");
        let resumeId: string | null = null;
        try {
          if (uploadTab === "file" && file) {
            const { resume } = await uploadResume(file);
            resumeId = resume.id;
          } else {
            const { resume } = await createResumeFromText({
              name: "My Resume",
              text: pastedText,
            });
            resumeId = resume.id;
          }
        } catch (err) {
          push({
            kind: "warning",
            title: "Resume upload failed",
            message:
              err instanceof ApiError
                ? err.message
                : "We saved your profile — you can upload from the dashboard.",
          });
        }

        if (resumeId) {
          setSubmitStatus("Analyzing…");
          try {
            await analyzeResume(resumeId);
          } catch {
            /* dashboard will show a Run Analysis button if this fails */
          }
        }
      }

      router.replace("/dashboard");
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't save",
        message: err instanceof ApiError ? err.message : "Please try again.",
      });
      setSubmitting(false);
      setSubmitStatus("");
    }
  }

  if (checking) {
    return (
      <main className="ob2-shell">
        <div className="ob2-card">
          <p className="ob2-muted">Loading…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="ob2-shell">
      <form className="ob2-card" onSubmit={handleSubmit}>
        <header className="ob2-header">
          <p className="ob2-step">Step 1 of 1 · Quick setup</p>
          <h1>Tell us a bit about you</h1>
          <p className="ob2-muted">
            Three short questions plus an optional resume upload — we&apos;ll have you scored in seconds.
          </p>
        </header>

        {/* ── Optional resume upload ── */}
        <div className="ob2-field">
          <div className="ob2-upload-head">
            <span className="ob2-upload-label">Resume <em>(optional)</em></span>
            <div className="ob2-upload-tabs">
              <button
                type="button"
                className={uploadTab === "file" ? "selected" : ""}
                onClick={() => setUploadTab("file")}
              >
                Upload file
              </button>
              <button
                type="button"
                className={uploadTab === "paste" ? "selected" : ""}
                onClick={() => setUploadTab("paste")}
              >
                Paste text
              </button>
            </div>
          </div>

          {uploadTab === "file" ? (
            <label className="ob2-dropzone" htmlFor="ob2-file">
              <input
                id="ob2-file"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFile(e.target.files?.[0] || null)
                }
              />
              {file ? (
                <>
                  <strong className="ob2-dropzone-name">{file.name}</strong>
                  <span className="ob2-dropzone-meta">
                    {(file.size / 1024).toFixed(0)} KB · click to change
                  </span>
                </>
              ) : (
                <>
                  <strong>Drop a PDF or DOCX</strong>
                  <span className="ob2-dropzone-meta">Max 5 MB · click to browse</span>
                </>
              )}
            </label>
          ) : (
            <textarea
              className="ob2-textarea"
              placeholder="Paste your full resume text here…"
              rows={6}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          )}
        </div>

        <fieldset className="ob2-field">
          <legend>What&apos;s your experience level?</legend>
          <div className="ob2-radio-grid">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`ob2-radio-card ${experienceLevel === opt.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="experience"
                  value={opt.value}
                  checked={experienceLevel === opt.value}
                  onChange={() => setExperienceLevel(opt.value)}
                />
                <span className="ob2-radio-title">{opt.label}</span>
                <span className="ob2-radio-sub">{opt.sub}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="ob2-field">
          <legend>What role are you targeting?</legend>
          <input
            type="text"
            className="ob2-input"
            placeholder="e.g. Software Engineer, Product Designer"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            maxLength={120}
            required
          />
        </fieldset>

        <fieldset className="ob2-field">
          <legend>What&apos;s your top goal right now?</legend>
          <div className="ob2-pill-grid">
            {GOAL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`ob2-pill ${primaryGoal === opt.value ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="goal"
                  value={opt.value}
                  checked={primaryGoal === opt.value}
                  onChange={() => setPrimaryGoal(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="ob2-submit" disabled={!profileValid || submitting}>
          {submitting ? submitStatus || "Saving…" : "Continue"}
        </button>
      </form>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
