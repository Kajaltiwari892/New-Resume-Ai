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
  FiArrowLeft,
  FiChevronUp,
  FiClock,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPlus,
  FiSearch,
  FiSettings,
  FiX,
  FiZap,
} from "react-icons/fi";
import { fetchResumeFileBlob } from "@/lib/resumeClient";
import { FileSearch } from "lucide-react";
import { Icon, type IconName } from "./Icon";
import {
  analyzingMessages,
  questionGroupOrder,
} from "./data";
import { ToastStack, useToasts } from "./Toast";
import { ApiError } from "@/lib/api";
import { logout, type PublicUser } from "@/lib/authClient";
import {
  analyzeResume,
  createResumeFromText,
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
  type InterviewQuestion,
  type KeywordMatch,
  type Profile,
  type Resume,
  type ResumeErrorRecord,
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


function severityClass(severity: string) {
  return severity.toLowerCase().replace(/\s+/g, "-");
}



function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

function ResumeFileViewer({ resume }: { resume: Resume }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(resume.hasFile));
  const [unavailable, setUnavailable] = useState<boolean>(() => !resume.hasFile);

  useEffect(() => {
    if (!resume.hasFile) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const blob = await fetchResumeFileBlob(resume.id);
        if (cancelled) return;
        if (!blob) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        url = URL.createObjectURL(blob);
        setFileUrl(url);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setUnavailable(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [resume.id, resume.hasFile]);

  const isPdf = (resume.mimeType || "").includes("pdf");

  if (loading) {
    return (
      <article className="resume-viewer resume-file-viewer">
        <p className="muted" style={{ padding: 24 }}>Loading your resume…</p>
      </article>
    );
  }

  if (unavailable || !fileUrl) {
    return (
      <article className="resume-viewer resume-file-viewer">
        <div style={{ padding: 24, textAlign: "center" }}>
          <p className="muted">Original resume preview isn&apos;t available for this entry.</p>
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Re-upload your PDF to see it here, or open the Suggestions tab to review insights.
          </p>
        </div>
      </article>
    );
  }

  if (isPdf) {
    return (
      <article className="resume-viewer resume-file-viewer">
        <iframe
          src={fileUrl}
          title={resume.name || "Resume"}
          style={{ width: "100%", height: "100%", border: 0, background: "#fff" }}
        />
      </article>
    );
  }

  return (
    <article className="resume-viewer resume-file-viewer">
      <div style={{ padding: 24, textAlign: "center" }}>
        <p className="muted">Preview isn&apos;t supported for this file type.</p>
        <a href={fileUrl} download={resume.name} className="primary-button" style={{ marginTop: 12, display: "inline-block" }}>
          Open original file
        </a>
      </div>
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
  const [targetRole, setTargetRole] = useState("");
  const [dreamCompanies, setDreamCompanies] = useState<string[]>([]);
  const [uploadTab, setUploadTab] = useState<UploadTab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ---- core data -------------------------------------------------------
  const [resume, setResume] = useState<Resume | null>(null);
  const [previousResume, setPreviousResume] = useState<Resume | null>(null);
  const [previousAnalysis, setPreviousAnalysis] = useState<Analysis | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [resumeErrors, setResumeErrors] = useState<ResumeErrorRecord[]>([]);
  const [errorsLoaded, setErrorsLoaded] = useState(false);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [rewritingErrorId, setRewritingErrorId] = useState<string | null>(null);
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewLoaded, setInterviewLoaded] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [keywordMatch, setKeywordMatch] = useState<KeywordMatch | null>(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [jobDescription, setJobDescription] = useState("");

  // ---- editor state ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>("Score");
  const [accordion, setAccordion] = useState<string>("Behavioral");
  const [panelWidth, setPanelWidth] = useState<number>(380);
  const [analysisSheetOpen, setAnalysisSheetOpen] = useState<boolean>(false);
  const resizingRef = useRef<boolean>(false);

  // Resize handle: drag to change analysis panel width (desktop only).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const next = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(300, Math.min(720, next)));
    };
    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startResize = useCallback(() => {
    resizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

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
    setSuggestionsLoading(false);
    setResumeErrors([]);
    setErrorsLoaded(false);
    setErrorsLoading(false);
    setRewritingErrorId(null);
    setInterviewQuestions([]);
    setInterviewLoaded(false);
    setInterviewLoading(false);
    setKeywordMatch(null);
    setKeywordLoading(false);
    setJobDescription("");
  }

  function handleStartNewResume() {
    setFile(null);
    setPastedText("");
    setUploadTab("file");
    if (resume) {
      setPreviousResume(resume);
      setPreviousAnalysis(analysis);
    }
    setResume(null);
    resetDerivedData();
    setActiveTab("Score");
    setMobileNavOpen(false);
    setMode("upload");
  }

  function handleBackToDashboard() {
    if (!previousResume) return;
    setResume(previousResume);
    setAnalysis(previousAnalysis);
    setFile(null);
    setPastedText("");
    setMode("dashboard");
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

  // Auto-load tabs the first time they're opened.
  useEffect(() => {
    if (mode !== "dashboard" || !resume) return;
    if (activeTab === "Errors" && !errorsLoaded && !errorsLoading) {
      void Promise.resolve().then(loadErrors);
    }
    if (activeTab === "Suggestions" && !suggestionsLoaded && !suggestionsLoading) {
      void Promise.resolve().then(loadSuggestions);
    }
    if (activeTab === "Interview" && !interviewLoaded && !interviewLoading) {
      void Promise.resolve().then(loadInterview);
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

  // Debounced keyword match.
  const keywordRequestId = useRef(0);
  useEffect(() => {
    if (!resume) return;
    const text = jobDescription.trim();
    if (text.length < 30) {
      const clearTimer = window.setTimeout(() => setKeywordMatch(null), 0);
      return () => window.clearTimeout(clearTimer);
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
          {previousResume && (
            <button
              type="button"
              className="analyzing-back-btn"
              onClick={handleBackToDashboard}
              aria-label="Back to dashboard"
            >
              <FiArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
          )}
          <div className="ob-card glass-panel">
            {/* Brand */}
            <div className="ob-brand">
              <span className="brand-glyph"><FileSearch size={16} strokeWidth={1.8} /></span>
              <strong>ResumeIQ</strong>
            </div>

            <div className="ob-header">
              <h1>Analyze your resume with AI</h1>
              <p>Upload a PDF or DOCX, then get a focused ATS score, fixes, keyword gaps, and interview prep in one workspace.</p>
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
              Files are parsed securely and attached only to your ResumeIQ account.
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
          <button
            type="button"
            className="analyzing-back-btn"
            onClick={() => {
              if (previousResume) {
                handleBackToDashboard();
              } else if (resume) {
                setMode("dashboard");
              } else {
                setMode("upload");
              }
            }}
            aria-label="Back to dashboard"
          >
            <FiArrowLeft size={16} />
            <span>Back</span>
          </button>
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
        <section
          className={`dashboard ${mobileNavOpen ? "nav-open" : ""} ${analysisSheetOpen ? "analysis-open" : ""}`}
          style={{ "--panel-width": `${panelWidth}px` } as React.CSSProperties}
        >
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
                <button
                  type="button"
                  className="sidebar-new-score"
                  onClick={handleStartNewResume}
                >
                  <FiPlus size={16} />
                  <span>Check New Resume Score</span>
                </button>
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

            <ResumeFileViewer key={resume.id} resume={resume} />
          </section>

          <div
            className="resize-handle"
            onMouseDown={startResize}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize analysis panel"
          />

          <aside className="analysis-panel">
            <button
              type="button"
              className="analysis-sheet-toggle"
              onClick={() => setAnalysisSheetOpen((open) => !open)}
              aria-label={analysisSheetOpen ? "Hide insights" : "Show insights"}
              aria-expanded={analysisSheetOpen}
            >
              <FiChevronUp size={18} />
              <span>{analysisSheetOpen ? "Hide insights" : "Show insights"}</span>
            </button>
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
                      Each item highlights a phrase to rewrite — use these as inspiration when updating your resume.
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
                  return (
                    <div
                      className={`issue-card error-card ${severityClass(error.severity)}`}
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
                        <div className="error-fix-block">
                          <span className="error-fix-label">Suggested rewrite</span>
                          <p className="error-fix">{error.fix}</p>
                        </div>
                      )}

                      {!error.fix && (
                        <div className="error-actions">
                          <button
                            type="button"
                            onClick={() => handleRewriteError(error.id)}
                            disabled={isRewriting}
                          >
                            {isRewriting ? "Generating…" : "Suggest rewrite"}
                          </button>
                        </div>
                      )}
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
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <div
                        className="suggestion-card"
                        style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
                        key={suggestion.id}
                      >
                        {/* Section badge */}
                        <div className="suggestion-card-head">
                          <span className="suggestion-section-badge">{suggestion.section}</span>
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

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </main>
  );
}
