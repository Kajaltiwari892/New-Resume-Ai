"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FiClock,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiSearch,
  FiSettings,
  FiX,
  FiZap,
} from "react-icons/fi";
import { FileSearch } from "lucide-react";
import { Icon, type IconName } from "./Icon";
import {
  analyzingMessages,
  questionGroupOrder,
  type ResumeSectionKey,
} from "./data";
import { ToastStack, useToasts } from "./Toast";
import { ApiError } from "@/lib/api";
import { logout, type PublicUser } from "@/lib/authClient";
import {
  analyzeResume,
  applyAllSuggestions as applyAllSuggestionsApi,
  applyErrorFix as applyErrorFixApi,
  applySuggestion as applySuggestionApi,
  createResumeFromText,
  downloadResumePdf,
  findErrors as findErrorsApi,
  generateInterviewQuestions as generateInterviewQuestionsApi,
  generateSuggestions as generateSuggestionsApi,
  getAnalysis,
  getOnboarding,
  listResumes,
  matchKeywords as matchKeywordsApi,
  rewriteError as rewriteErrorApi,
  uploadResume,
  type Analysis,
  type ExportOptions,
  type InterviewQuestion,
  type KeywordMatch,
  type Profile,
  type Resume,
  type ResumeErrorRecord,
  type ResumeSections,
  type Suggestion,
} from "@/lib/resumeClient";

type Mode = "upload" | "analyzing" | "dashboard";
type UploadTab = "file" | "paste";
type TabKey = "Score" | "Errors" | "Suggestions" | "Interview" | "Keywords";

const BAR_ICON_BY_KEY: Record<string, IconName> = {
  ats: "target",
  ats_keywords: "target",
  impact: "light",
  verb: "spark",
  bullet: "file",
  leadership: "brain",
  formatting: "layout",
  summary: "edit",
  projects: "grid",
  content: "file",
  keyword: "key",
};

const GRADE_CONFIG: Record<string, { color: string; label: string }> = {
  A: { color: "#10B981", label: "Excellent" },
  B: { color: "#7C3AED", label: "Good" },
  C: { color: "#F59E0B", label: "Average" },
  D: { color: "#F97316", label: "Below Average" },
  F: { color: "#EF4444", label: "Needs Major Work" },
};


const TEMPLATES: ExportOptions["template"][] = ["Modern", "Classic", "Minimal", "ATS-Safe"];
const ACCENT_COLORS = ["#7C3AED", "#06B6D4", "#F43F5E", "#10B981", "#C4B5FD"];
const FONT_OPTIONS = ["Inter", "IBM Plex Sans", "System UI"];

function severityClass(severity: string) {
  return severity.toLowerCase().replace(/\s+/g, "-");
}



function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function ResumeViewer({ resume, user, targetRole, jobTitle }: {
  resume: Resume;
  user: PublicUser;
  targetRole: string;
  jobTitle: string;
}) {
  const sections = resume.sections;
  const skills = (sections.skills || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const experienceLines = (sections.experience || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <article className="resume-viewer">
      <header className="rv-header">
        <div className="rv-avatar">{(user.name || "?")[0].toUpperCase()}</div>
        <div>
          <h2>{user.name || "Your Name"}</h2>
          <p>{targetRole || jobTitle || "Your Target Role"}</p>
          <span>{user.email}</span>
        </div>
      </header>

      {sections.summary && (
        <div className="rv-section">
          <div className="rv-section-label">Summary</div>
          <p className="rv-summary-text">{sections.summary}</p>
        </div>
      )}

      {experienceLines.length > 0 && (
        <div className="rv-section">
          <div className="rv-section-label">Experience</div>
          <ul className="rv-exp-list">
            {experienceLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {skills.length > 0 && (
        <div className="rv-section">
          <div className="rv-section-label">Skills</div>
          <div className="rv-skill-chips">
            {skills.map((skill, i) => (
              <span key={i} className="rv-skill-chip">{skill}</span>
            ))}
          </div>
        </div>
      )}

      {sections.education && (
        <div className="rv-section">
          <div className="rv-section-label">Education</div>
          <p className="rv-education-text">{sections.education}</p>
        </div>
      )}
    </article>
  );
}

export default function DashboardApp({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  // ---- boot + mode -----------------------------------------------------
  const [mode, setMode] = useState<Mode>("upload");
  const [booting, setBooting] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  // ---- profile snapshot (read-only here; editing lives in /onboarding) -
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [dreamCompanies, setDreamCompanies] = useState<string[]>([]);
  const [uploadTab, setUploadTab] = useState<UploadTab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---- core data -------------------------------------------------------
  const [resume, setResume] = useState<Resume | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [resumeErrors, setResumeErrors] = useState<ResumeErrorRecord[]>([]);
  const [errorsLoaded, setErrorsLoaded] = useState(false);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [rewritingErrorId, setRewritingErrorId] = useState<string | null>(null);
  const [applyingErrorId, setApplyingErrorId] = useState<string | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewLoaded, setInterviewLoaded] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [keywordMatch, setKeywordMatch] = useState<KeywordMatch | null>(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [jobDescription, setJobDescription] = useState("");

  // ---- editor state ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>("Score");
  const [accordion, setAccordion] = useState<string>("Behavioral");

  // ---- download modal --------------------------------------------------
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadTemplate, setDownloadTemplate] =
    useState<ExportOptions["template"]>("Modern");
  const [downloadFont, setDownloadFont] = useState<string>("Inter");
  const [downloadAccent, setDownloadAccent] = useState<string>(ACCENT_COLORS[0]);
  const [includeAiSummary, setIncludeAiSummary] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Live-rotating analyzing message.
  useEffect(() => {
    if (mode !== "analyzing") return;
    const timer = window.setInterval(() => {
      setMessageIndex((i) => (i + 1) % analyzingMessages.length);
    }, 950);
    return () => window.clearInterval(timer);
  }, [mode]);

  // Close mobile drawer on Esc; lock body scroll while open.
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);



  const runAnalyze = useCallback(
    async (resumeId: string) => {
      try {
        const { analysis: next } = await analyzeResume(resumeId);
        setAnalysis(next);
        return next;
      } catch (err) {
        push({
          kind: "error",
          title: "Analysis failed",
          message: errorMessage(err, "We couldn't score your resume just yet."),
        });
        return null;
      }
    },
    [push],
  );

  // Boot: hydrate profile + most-recent resume + analysis.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [onboardingRes, resumesRes] = await Promise.all([
          getOnboarding().catch(() => ({ profile: null as Profile | null })),
          listResumes().catch(() => ({ resumes: [] as Resume[] })),
        ]);
        if (cancelled) return;

        const profile = onboardingRes.profile;
        if (profile) {
          setFullName(profile.fullName || user.name || "");
          setJobTitle(profile.jobTitle || "");
          setTargetRole(profile.targetRole || "");
          setDreamCompanies(profile.dreamCompanies || []);
        } else {
          setFullName(user.name || "");
        }

        const latest = resumesRes.resumes[0];
        if (latest) {
          setResume(latest);
          try {
            const { analysis: existing } = await getAnalysis(latest.id);
            if (!cancelled) setAnalysis(existing);
          } catch {
            /* no analysis yet — leave null */
          }
          if (!cancelled) setMode("dashboard");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.name]);

  // ---- onboarding actions ---------------------------------------------

  function validateUpload(): string | null {
    if (uploadTab === "file" && !file) return "Please upload a PDF or DOCX resume.";
    if (uploadTab === "paste" && pastedText.trim().length < 50)
      return "Paste at least 50 characters of your resume.";
    return null;
  }

  async function handleAnalyzeFlow() {
    const error = validateUpload();
    if (error) {
      push({ kind: "warning", title: "One more thing", message: error });
      return;
    }
    setSubmitting(true);
    try {
      let newResume: Resume;
      if (uploadTab === "file" && file) {
        const { resume: created } = await uploadResume(file);
        newResume = created;
      } else {
        const { resume: created } = await createResumeFromText({
          name: `${user.name || "My"} Resume`,
          text: pastedText,
        });
        newResume = created;
      }

      setResume(newResume);
      resetDerivedData();
      setMode("analyzing");

      const result = await runAnalyze(newResume.id);
      setMode("dashboard");
      if (result) {
        push({
          kind: "success",
          title: "Analysis complete",
          message: `Your ATS score: ${result.overallScore}/100`,
        });
      }
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't start analysis",
        message: errorMessage(err, "Something went wrong — please try again."),
      });
      setMode("upload");
    } finally {
      setSubmitting(false);
    }
  }

  function resetDerivedData() {
    setAnalysis(null);
    setSuggestions([]);
    setSuggestionsLoaded(false);
    setInterviewQuestions([]);
    setInterviewLoaded(false);
    setKeywordMatch(null);
    setJobDescription("");
  }

  // ---- resume editing removed (read-only viewer) -----------------------

  // ---- analysis / suggestions / interview / keywords -------------------

  async function handleReanalyze() {
    if (!resume) return;
    setMode("analyzing");
    await runAnalyze(resume.id);
    setMode("dashboard");
  }

  const loadSuggestions = useCallback(async () => {
    if (!resume || suggestionsLoading) return;
    setSuggestionsLoading(true);
    try {
      const { suggestions: next } = await generateSuggestionsApi(resume.id);
      setSuggestions(next);
      setSuggestionsLoaded(true);
    } catch (err) {
      push({
        kind: "error",
        title: "No suggestions",
        message: errorMessage(err, "We couldn't generate suggestions just now."),
      });
    } finally {
      setSuggestionsLoading(false);
    }
  }, [resume, suggestionsLoading, push]);

  const loadInterview = useCallback(async () => {
    if (!resume || interviewLoading) return;
    setInterviewLoading(true);
    try {
      const { questions } = await generateInterviewQuestionsApi(resume.id, 2);
      setInterviewQuestions(questions);
      setInterviewLoaded(true);
      const firstGroup = questions[0]?.group;
      if (firstGroup) setAccordion(firstGroup);
    } catch (err) {
      push({
        kind: "error",
        title: "Interview prep failed",
        message: errorMessage(err, "We couldn't generate questions just now."),
      });
    } finally {
      setInterviewLoading(false);
    }
  }, [resume, interviewLoading, push]);

  const loadErrors = useCallback(async () => {
    if (!resume || errorsLoading) return;
    setErrorsLoading(true);
    try {
      const { errors } = await findErrorsApi(resume.id);
      setResumeErrors(errors);
      setErrorsLoaded(true);
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't scan errors",
        message: errorMessage(err, "Please try again in a moment."),
      });
    } finally {
      setErrorsLoading(false);
    }
  }, [resume, errorsLoading, push]);

  async function handleRewriteError(errorId: string) {
    if (!resume || rewritingErrorId) return;
    setRewritingErrorId(errorId);
    try {
      const { error: next } = await rewriteErrorApi(resume.id, errorId);
      setResumeErrors((list) => list.map((e) => (e.id === errorId ? next : e)));
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't generate fix",
        message: errorMessage(err, "Please try again."),
      });
    } finally {
      setRewritingErrorId(null);
    }
  }

  async function handleApplyError(errorId: string) {
    if (!resume || applyingErrorId) return;
    setApplyingErrorId(errorId);
    try {
      const { resume: nextResume, error: nextError } = await applyErrorFixApi(
        resume.id,
        errorId,
      );
      setResume(nextResume);
      setResumeErrors((list) => list.map((e) => (e.id === errorId ? nextError : e)));
      push({ kind: "success", title: "Fix applied" });
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't apply fix",
        message: errorMessage(err, "Please try again."),
      });
    } finally {
      setApplyingErrorId(null);
    }
  }

  // Auto-load tabs the first time they're opened.
  useEffect(() => {
    if (mode !== "dashboard" || !resume) return;
    if (activeTab === "Errors" && !errorsLoaded && !errorsLoading) {
      loadErrors();
    }
    if (activeTab === "Suggestions" && !suggestionsLoaded && !suggestionsLoading) {
      loadSuggestions();
    }
    if (activeTab === "Interview" && !interviewLoaded && !interviewLoading) {
      loadInterview();
    }
  }, [
    activeTab,
    mode,
    resume,
    errorsLoaded,
    errorsLoading,
    suggestionsLoaded,
    suggestionsLoading,
    interviewLoaded,
    interviewLoading,
    loadErrors,
    loadSuggestions,
    loadInterview,
  ]);

  async function handleApply(suggestionId: string) {
    if (!resume) return;
    try {
      const { resume: nextResume, suggestion: nextSuggestion } = await applySuggestionApi(
        resume.id,
        suggestionId,
      );
      setResume(nextResume);
      setSuggestions((list) =>
        list.map((s) => (s.id === suggestionId ? nextSuggestion : s)),
      );
      push({ kind: "success", title: "Suggestion applied" });
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't apply",
        message: errorMessage(err, "Please try again."),
      });
    }
  }

  async function handleApplyAll() {
    if (!resume) return;
    try {
      const { resume: nextResume, suggestions: nextSuggestions } =
        await applyAllSuggestionsApi(resume.id);
      setResume(nextResume);
      if (nextSuggestions) {
        setSuggestions((list) =>
          list.map((s) => {
            const updated = nextSuggestions.find((n) => n.id === s.id);
            return updated ?? { ...s, applied: true };
          }),
        );
      } else {
        setSuggestions((list) => list.map((s) => ({ ...s, applied: true })));
      }
      push({ kind: "success", title: "All suggestions applied" });
    } catch (err) {
      push({
        kind: "error",
        title: "Apply-all failed",
        message: errorMessage(err, "Please try again."),
      });
    }
  }

  // Debounced keyword match.
  const keywordRequestId = useRef(0);
  useEffect(() => {
    if (!resume) return;
    const text = jobDescription.trim();
    if (text.length < 30) {
      setKeywordMatch(null);
      return;
    }
    const myId = ++keywordRequestId.current;
    const timer = window.setTimeout(async () => {
      setKeywordLoading(true);
      try {
        const { match } = await matchKeywordsApi(resume.id, text);
        if (myId === keywordRequestId.current) setKeywordMatch(match);
      } catch (err) {
        if (myId === keywordRequestId.current) {
          push({
            kind: "error",
            title: "Keyword match failed",
            message: errorMessage(err, "Try a longer description."),
          });
        }
      } finally {
        if (myId === keywordRequestId.current) setKeywordLoading(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [jobDescription, resume, push]);

  // ---- download --------------------------------------------------------

  async function handleDownload() {
    if (!resume || downloading) return;
    setDownloading(true);
    try {
      const { blob, filename } = await downloadResumePdf(resume.id, {
        template: downloadTemplate,
        font: downloadFont,
        accent: downloadAccent,
        includeAiSummary,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloadOpen(false);
      push({ kind: "success", title: "PDF ready", message: `Saved as ${filename}` });
    } catch (err) {
      push({
        kind: "error",
        title: "Download failed",
        message: errorMessage(err, "Please try again."),
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/auth");
    }
  }

  // ---- derived ---------------------------------------------------------

  const groupedQuestions = useMemo(() => {
    const byGroup: Record<string, InterviewQuestion[]> = {};
    for (const g of questionGroupOrder) byGroup[g] = [];
    for (const q of interviewQuestions) {
      if (!byGroup[q.group]) byGroup[q.group] = [];
      byGroup[q.group].push(q);
    }
    return byGroup;
  }, [interviewQuestions]);

  const headerName = fullName || user.name;
  const headerInitials = useMemo(() => {
    const parts = headerName.trim().split(/\s+/);
    const a = parts[0]?.[0] || "?";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase();
  }, [headerName]);

  const resumeFileName = resume?.name || "Resume.pdf";

  // ---- render ----------------------------------------------------------

  if (booting) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
        <section className="analysis-overlay">
          <div className="loader-card glass-panel">
            <Icon name="brain" />
            <h1>Loading your workspace…</h1>
            <p>Fetching your profile and resumes.</p>
            <div className="skeleton-stack">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
        <ToastStack toasts={toasts} onDismiss={dismiss} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="ambient-grid" />

      {mode === "upload" && (
        <section className="ob-stage" aria-label="Upload your resume">
          <div className="ob-card glass-panel">
            {/* Brand */}
            <div className="ob-brand">
              <span className="brand-glyph"><FileSearch size={16} strokeWidth={1.8} /></span>
              <strong>ResumeIQ</strong>
            </div>

            <div className="ob-header">
              <h1>Analyze your resume with AI</h1>
              <p>Upload your resume and get an instant ATS score, improvement suggestions, and interview prep.</p>
            </div>

            {/* Upload tabs */}
            <div className="ob-tabs">
              <button
                type="button"
                className={uploadTab === "file" ? "active" : ""}
                onClick={() => setUploadTab("file")}
                id="ob-tab-file"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                Upload File
              </button>
              <button
                type="button"
                className={uploadTab === "paste" ? "active" : ""}
                onClick={() => setUploadTab("paste")}
                id="ob-tab-paste"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                Paste Text
              </button>
            </div>

            {/* Upload area */}
            {uploadTab === "file" ? (
              <label className="ob-dropzone" htmlFor="ob-file-input">
                <input
                  id="ob-file-input"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                />
                <div className="ob-dropzone-inner">
                  {file ? (
                    <>
                      <span className="ob-file-icon">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </span>
                      <b className="ob-file-name">{file.name}</b>
                      <small className="ob-file-meta">{(file.size / 1024).toFixed(0)} KB · Click to change</small>
                    </>
                  ) : (
                    <>
                      <span className="ob-upload-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      </span>
                      <b>Drop your resume here</b>
                      <small>PDF or DOCX · Max 5 MB</small>
                      <span className="ob-browse-btn">Browse Files</span>
                    </>
                  )}
                </div>
              </label>
            ) : (
              <textarea
                className="ob-paste-area"
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your full resume text here…"
                rows={10}
                aria-label="Resume text"
              />
            )}

            {/* Supported formats hint */}
            <p className="ob-hint">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              Your data is never stored beyond the session. Supports PDF and DOCX.
            </p>

            {/* CTA */}
            <button
              type="button"
              className="ob-analyze-btn"
              onClick={handleAnalyzeFlow}
              disabled={submitting}
              id="ob-analyze-btn"
            >
              {submitting ? (
                <><span className="ob-spinner" aria-hidden /> Uploading…</>
              ) : (
                <>
                  Analyze My Resume
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </>
              )}
            </button>

            {/* Trust signals */}
            <div className="ob-trust">
              <span>🔒 Secure upload</span>
              <span>⚡ Results in ~10 sec</span>
              <span>🎯 ATS-verified scoring</span>
            </div>
          </div>
        </section>
      )}

      {mode === "analyzing" && (
        <section className="analysis-overlay">
          <div className="particle-field">
            {Array.from({ length: 18 }).map((_, index) => (
              <span key={index} style={{ "--i": index } as React.CSSProperties} />
            ))}
          </div>
          <div className="loader-card glass-panel">
            <Icon name="brain" />
            <h1>AI is analyzing your resume...</h1>
            <p>{analyzingMessages[messageIndex]}</p>
            <div className="skeleton-stack">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
      )}

      {mode === "dashboard" && resume && (
        <section className={`dashboard ${mobileNavOpen ? "nav-open" : ""}`}>
          {mobileNavOpen && (
            <div
              className="mobile-nav-backdrop"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
          )}
          <aside className="sidebar">
            <div className="sidebar-scroll">
              <div className="brand-mark">
                <span className="brand-glyph">
                  <FileSearch size={14} strokeWidth={1.8} />
                </span>
                <strong>ResumeIQ</strong>
                <button
                  type="button"
                  className="ghost-button mobile-nav-close"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close menu"
                >
                  <FiX size={16} />
                </button>
              </div>
              <nav>
                {(
                  [
                    [FiGrid, "Dashboard", "/dashboard"],
                    [FiFileText, "My Resumes", "/resumes"],
                    [FiMessageSquare, "Interview Prep", "/interview"],
                    [FiClock, "History", "/history"],
                    [FiSettings, "Settings", "/settings"],
                  ] as const
                ).map(([NavIcon, label, href]) => (
                  <Link
                    href={href}
                    className={label === "Dashboard" ? "active" : ""}
                    key={label}
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <NavIcon size={16} />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
              <div className="upgrade-card">
                <b>Upgrade to Pro</b>
                <p>Unlock unlimited AI rewrites and interview drills.</p>
                <button>Upgrade</button>
              </div>
              <div className="profile-card">
                <span>{headerInitials}</span>
                <div>
                  <b>{headerName}</b>
                  <small>Free plan</small>
                </div>
                <button
                  type="button"
                  className="ghost-button sidebar-logout"
                  onClick={handleLogout}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <FiLogOut size={14} />
                </button>
              </div>
            </div>
          </aside>

          <section className="resume-workbench">
            <div className="topbar">
              <button
                type="button"
                className="ghost-button mobile-nav-toggle"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                <FiMenu size={18} />
              </button>
              <div>
                <small>Resume Preview</small>
                <h1>{resumeFileName}</h1>
              </div>
              <div className="topbar-actions">
                <button onClick={handleReanalyze} title="Re-run analysis">
                  <FiZap size={14} /> Re-analyze
                </button>
                <button aria-label="Search" title="Search">
                  <FiSearch size={15} />
                </button>
                <button aria-label="Help" title="Help">
                  <FiHelpCircle size={15} />
                </button>
              </div>
            </div>

            <ResumeViewer
              resume={resume}
              user={user}
              targetRole={targetRole}
              jobTitle={jobTitle}
            />

            <div className="viewer-download-bar">
              <button className="download-paper" onClick={() => setDownloadOpen(true)}>
                <Icon name="download" /> Download as PDF
              </button>
            </div>
          </section>

          <aside className="analysis-panel">
            <div className="tabs">
              {(["Score", "Errors", "Suggestions", "Interview", "Keywords"] as TabKey[]).map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? "active" : ""}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "Score" && (
              <div className="tab-panel">
                {analysis ? (
                  <>
                    <div
                      className="score-dial"
                      style={{ "--score": analysis.overallScore } as React.CSSProperties}
                    >
                      <strong>{analysis.overallScore}</strong>
                      <span>/100</span>
                    </div>
                    {/* Score dial + grade */}
                    <div className="score-header">
                      <div
                        className="score-dial"
                        style={{ "--score": analysis.overallScore } as React.CSSProperties}
                      >
                        <strong>{analysis.overallScore}</strong>
                        <span>/100</span>
                      </div>
                      {analysis.grade && (
                        <div
                          className="grade-badge"
                          style={{ "--grade-color": GRADE_CONFIG[analysis.grade]?.color || "#7C3AED" } as React.CSSProperties}
                        >
                          <span className="grade-letter">{analysis.grade}</span>
                          <span className="grade-label">{GRADE_CONFIG[analysis.grade]?.label}</span>
                        </div>
                      )}
                    </div>

                    {/* Verdict */}
                    {analysis.verdict && (
                      <div className="verdict-card">
                        <Icon name="brain" />
                        <p>&ldquo;{analysis.verdict}&rdquo;</p>
                      </div>
                    )}

                    {/* ATS stats */}
                    {(analysis.atsPassProbability || analysis.estimatedInterviewRate) && (
                      <div className="ats-stats-row">
                        {analysis.atsPassProbability && (
                          <div className={`ats-stat ats-${analysis.atsPassProbability}`}>
                            <span className="ats-stat-label">ATS Pass</span>
                            <b className="ats-stat-value">{analysis.atsPassProbability.toUpperCase()}</b>
                          </div>
                        )}
                        {analysis.estimatedInterviewRate && (
                          <div className="ats-stat">
                            <span className="ats-stat-label">Interview Rate</span>
                            <b className="ats-stat-value">{analysis.estimatedInterviewRate}</b>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Top 3 priorities */}
                    {analysis.top3Priorities && analysis.top3Priorities.length > 0 && (
                      <>
                        <h3 className="panel-section-title">🎯 Top Priorities</h3>
                        <ol className="top-priorities-list">
                          {analysis.top3Priorities.map((p, i) => (
                            <li key={i}><span>{i + 1}</span>{p}</li>
                          ))}
                        </ol>
                      </>
                    )}

                    {/* 8 Dimension bars */}
                    <h3 className="panel-section-title">📊 Dimension Breakdown</h3>
                    <div className="score-list">
                      {analysis.bars.map((bar) => (
                        <div key={bar.key}>
                          <span>
                            <Icon name={BAR_ICON_BY_KEY[bar.key] || "target"} /> {bar.label}
                          </span>
                          <b>{bar.value}%</b>
                          <em>
                            <i style={{ width: `${bar.value}%`, background: bar.value >= 70 ? "#10B981" : bar.value >= 40 ? "#F59E0B" : "#EF4444" }} />
                          </em>
                        </div>
                      ))}
                    </div>

                    {/* Rich issues */}
                    <h3 className="panel-section-title">⚠️ Issues Found</h3>
                    {analysis.issues.length === 0 && (
                      <div className="win-card">
                        <Icon name="check" /> No critical issues found.
                      </div>
                    )}
                    {analysis.issues.map((issue, idx) => (
                      <div
                        className={`issue-card ${severityClass(issue.severity)}`}
                        key={`${idx}-${issue.title}`}
                      >
                        <div className="issue-card-head">
                          <span className="issue-severity">{issue.severity}</span>
                          {issue.category && <span className="issue-category">{issue.category}</span>}
                        </div>
                        <b className="issue-title">{issue.title}</b>
                        {issue.location && <small className="issue-location">📍 {issue.location}</small>}
                        <p className="issue-description">{issue.description || issue.body}</p>
                        {issue.original_text && (
                          <div className="issue-original">
                            <span>Original:</span>
                            <del>{issue.original_text}</del>
                          </div>
                        )}
                        {issue.example_fix && (
                          <div className="issue-fix">
                            <span>Better:</span>
                            <q>{issue.example_fix}</q>
                          </div>
                        )}
                        {issue.fix_instruction && (
                          <p className="issue-instruction">💡 {issue.fix_instruction}</p>
                        )}
                        <button
                          onClick={() => {
                            setActiveTab("Suggestions");
                            if (!suggestionsLoaded) loadSuggestions();
                          }}
                        >
                          Get AI Fix
                        </button>
                      </div>
                    ))}

                    {/* Interview red flags */}
                    {analysis.interviewRedFlags && analysis.interviewRedFlags.length > 0 && (
                      <>
                        <h3 className="panel-section-title">🚩 Interview Red Flags</h3>
                        <div className="red-flags-list">
                          {analysis.interviewRedFlags.map((flag, i) => (
                            <div className="red-flag-item" key={i}>
                              <span>⚠</span>
                              <p>{flag}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Positives */}
                    <h3 className="panel-section-title">✅ What You&apos;re Doing Well</h3>
                    {(analysis.positives && analysis.positives.length > 0) ? (
                      analysis.positives.map((item, idx) => (
                        <div className="win-card" key={`${idx}-${item.title}`}>
                          <Icon name="check" />
                          <div>
                            <b>{item.title}</b>
                            {item.description && <p>{item.description}</p>}
                          </div>
                        </div>
                      ))
                    ) : analysis.wins.length > 0 ? (
                      analysis.wins.map((item, idx) => (
                        <div className="win-card" key={`${idx}-${item}`}>
                          <Icon name="check" /> {item}
                        </div>
                      ))
                    ) : (
                      <div className="win-card">
                        <Icon name="check" /> Strong foundations to build on.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-panel">
                    <p>No analysis yet.</p>
                    <button className="primary-button" onClick={handleReanalyze}>
                      Run analysis
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "Errors" && (
              <div className="tab-panel">
                <div className="errors-head">
                  <div>
                    <h2>Line-level errors</h2>
                    <p className="errors-sub">
                      Each item is a concrete fix. Click <em>Get AI fix</em>, review, then <em>Apply</em>.
                    </p>
                  </div>
                  <button
                    className="errors-rescan"
                    onClick={loadErrors}
                    disabled={errorsLoading}
                  >
                    {errorsLoading ? "Scanning…" : errorsLoaded ? "Re-scan" : "Scan"}
                  </button>
                </div>

                {errorsLoading && !resumeErrors.length && (
                  <div className="empty-panel">
                    <p>Scanning your resume for errors…</p>
                  </div>
                )}
                {!errorsLoading && errorsLoaded && !resumeErrors.length && (
                  <div className="win-card">
                    <Icon name="check" /> No line-level errors found.
                  </div>
                )}
                {resumeErrors.map((error, index) => {
                  const isRewriting = rewritingErrorId === error.id;
                  const isApplying = applyingErrorId === error.id;
                  return (
                    <div
                      className={`issue-card error-card ${severityClass(error.severity)} ${error.applied ? "applied" : ""}`}
                      style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                      key={error.id}
                    >
                      <div className="error-head">
                        <span>{error.severity}</span>
                        <em className="error-category">{error.category}</em>
                        <em className="error-section">{error.section}</em>
                      </div>
                      <del className="error-line">{error.line}</del>
                      <p className="error-reason">{error.reason}</p>

                      {error.fix && (
                        <p className="error-fix">{error.fix}</p>
                      )}

                      <div className="error-actions">
                        {!error.applied && !error.fix && (
                          <button
                            type="button"
                            onClick={() => handleRewriteError(error.id)}
                            disabled={isRewriting}
                          >
                            {isRewriting ? "Generating…" : "Get AI fix"}
                          </button>
                        )}
                        {!error.applied && error.fix && (
                          <>
                            <button
                              type="button"
                              className="primary-button"
                              onClick={() => handleApplyError(error.id)}
                              disabled={isApplying}
                            >
                              {isApplying ? "Applying…" : "Apply"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRewriteError(error.id)}
                              disabled={isRewriting}
                            >
                              {isRewriting ? "…" : "Regenerate"}
                            </button>
                          </>
                        )}
                        {error.applied && (
                          <span className="error-applied-badge">
                            <Icon name="check" /> Applied
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "Suggestions" && (
              <div className="tab-panel">
                {suggestionsLoading && !suggestions.length && (
                  <div className="empty-panel">
                    <p>Scanning every bullet against FAANG standards…</p>
                  </div>
                )}
                {!suggestionsLoading && !suggestions.length && (
                  <div className="empty-panel">
                    <p>No suggestions yet.</p>
                    <button className="primary-button" onClick={loadSuggestions}>
                      Generate suggestions
                    </button>
                  </div>
                )}
                {suggestions.length > 0 && (
                  <>
                    <div className="suggestions-header">
                      <span className="suggestions-count">{suggestions.length} improvements found</span>
                      <button
                        className="apply-all"
                        onClick={handleApplyAll}
                        disabled={suggestions.every((s) => s.applied)}
                      >
                        Apply All
                      </button>
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <div
                        className={`suggestion-card ${suggestion.applied ? "applied" : ""}`}
                        style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                        key={suggestion.id}
                      >
                        {/* Section badge */}
                        <div className="suggestion-card-head">
                          <span className="suggestion-section-badge">{suggestion.section}</span>
                          {suggestion.applied && (
                            <span className="suggestion-applied-badge">
                              <Icon name="check" /> Applied
                            </span>
                          )}
                        </div>

                        {/* Why it was flagged */}
                        {suggestion.reason && (
                          <p className="suggestion-reason">⚡ {suggestion.reason}</p>
                        )}

                        {/* Original (struck out) */}
                        <div className="suggestion-original">
                          <span>Original</span>
                          <del>{suggestion.old}</del>
                        </div>

                        {/* AI Rewrite */}
                        <div className="suggestion-rewrite">
                          <span>Improved</span>
                          <p>{suggestion.next}</p>
                        </div>

                        <button
                          className={suggestion.applied ? "" : "primary-button"}
                          onClick={() => handleApply(suggestion.id)}
                          disabled={suggestion.applied}
                        >
                          {suggestion.applied ? "✓ Applied" : "Apply Fix"}
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {activeTab === "Interview" && (
              <div className="tab-panel">
                <h2>
                  Questions likely for {targetRole || "your target role"}
                  {dreamCompanies[0] ? ` at ${dreamCompanies[0]}` : ""}
                </h2>
                {interviewLoading && !interviewQuestions.length && (
                  <div className="empty-panel">
                    <p>Generating interview questions…</p>
                  </div>
                )}
                {!interviewLoading && !interviewQuestions.length && (
                  <div className="empty-panel">
                    <p>No questions yet.</p>
                    <button className="primary-button" onClick={loadInterview}>
                      Generate questions
                    </button>
                  </div>
                )}
                {questionGroupOrder.map((group, groupIdx) => {
                  const items = groupedQuestions[group] || [];
                  if (!items.length) return null;
                  return (
                    <div className="accordion" key={group}>
                      <button onClick={() => setAccordion(accordion === group ? "" : group)}>
                        {group}
                        <span>{accordion === group ? "-" : "+"}</span>
                      </button>
                      {accordion === group &&
                        items.slice(0, 4).map((question) => (
                          <div className="question-card" key={question.id}>
                            <p>{question.text}</p>
                            <span>{question.difficulty}</span>
                          </div>
                        ))}
                      {groupIdx === 1 && (
                        <div className="tip-card">
                          Pro Tip: Use the STAR method for behavioral answers.
                        </div>
                      )}
                    </div>
                  );
                })}
                {interviewQuestions.length > 0 && (
                  <button
                    className="primary-button panel-cta"
                    onClick={loadInterview}
                    disabled={interviewLoading}
                  >
                    {interviewLoading ? "Generating…" : "Generate More Questions"}
                  </button>
                )}
              </div>
            )}

            {activeTab === "Keywords" && (
              <div className="tab-panel">
                <textarea
                  className="job-input"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste Job Description to enable keyword matching..."
                  rows={6}
                />
                {keywordLoading && (
                  <p className="empty-panel">
                    <span>Matching keywords…</span>
                  </p>
                )}
                {keywordMatch && (
                  <>
                    <div className="word-cloud">
                      {[...keywordMatch.found, ...keywordMatch.missing].map((word, idx) => (
                        <span
                          className={idx < keywordMatch.found.length ? "found" : "missing"}
                          key={`${idx}-${word}`}
                        >
                          {word}
                        </span>
                      ))}
                    </div>
                    <div className="keyword-columns">
                      <div>
                        <h3>Found in Resume</h3>
                        {keywordMatch.found.length === 0 && <p className="empty-line">None found yet.</p>}
                        {keywordMatch.found.map((word, idx) => (
                          <span key={`${idx}-${word}`}>
                            <Icon name="check" /> {word}
                          </span>
                        ))}
                      </div>
                      <div>
                        <h3>Missing</h3>
                        {keywordMatch.missing.length === 0 && (
                          <p className="empty-line">Great — nothing obvious is missing.</p>
                        )}
                        {keywordMatch.missing.map((word, idx) => (
                          <span key={`${idx}-${word}`}>× {word}</span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {!keywordLoading && !keywordMatch && jobDescription.trim().length < 30 && (
                  <p className="empty-line">Paste at least 30 characters to match keywords.</p>
                )}
              </div>
            )}
          </aside>
        </section>
      )}

      {downloadOpen && resume && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Download resume">
          <div className="download-modal">
            <section className="export-preview">
              <h2>Export Preview</h2>
              <p>Final document styling</p>
              <div className="mini-paper" style={{ "--accent": downloadAccent } as React.CSSProperties}>
                <span />
                <b />
                <i />
                <em />
              </div>
              <div className="format-pills">
                <span>A4 Format</span>
                <span>{downloadTemplate}</span>
              </div>
            </section>
            <section className="download-settings">
              <button
                className="close-button"
                onClick={() => setDownloadOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h2>Download Settings</h2>
              <p>Tailor your document for its destination.</p>
              <label className="field-label">Select template</label>
              <div className="template-grid">
                {TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    className={template === downloadTemplate ? "active" : ""}
                    onClick={() => setDownloadTemplate(template)}
                  >
                    <Icon name={template === "Modern" ? "grid" : "file"} />
                    <b>{template}</b>
                    <span>{template === "ATS-Safe" ? "Optimized parsing" : "Professional layout"}</span>
                  </button>
                ))}
              </div>
              <div className="settings-grid">
                <label>
                  Typography
                  <select
                    value={downloadFont}
                    onChange={(e) => setDownloadFont(e.target.value)}
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font}>{font}</option>
                    ))}
                  </select>
                </label>
                <div>
                  <label className="field-label">Color accent</label>
                  <div className="color-dots">
                    {ACCENT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={color === downloadAccent ? "active" : ""}
                        style={{ backgroundColor: color }}
                        aria-label={`Accent ${color}`}
                        onClick={() => setDownloadAccent(color)}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="toggle-card bordered">
                <Icon name="brain" />
                <div>
                  <b>Include AI Summary Header</b>
                  <p>Adds a generated profile summary based on your experience.</p>
                </div>
                <button
                  type="button"
                  className={`switch ${includeAiSummary ? "on" : ""}`}
                  onClick={() => setIncludeAiSummary((v) => !v)}
                  aria-pressed={includeAiSummary}
                >
                  <span />
                </button>
              </div>
              <div className="modal-actions">
                <button
                  className="primary-button"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  <Icon name="download" /> {downloading ? "Preparing…" : "Download PDF"}
                </button>
                <button onClick={() => setDownloadOpen(false)}>Cancel</button>
              </div>
            </section>
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
