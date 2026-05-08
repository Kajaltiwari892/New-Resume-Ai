"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import {
  analyzingMessages,
  experienceLevels,
  industries,
  priorities as priorityOptions,
  questionGroupOrder,
  resumeTypeCopy,
  resumeTypes,
  roles,
  type ResumeSectionKey,
} from "./data";
import { ToastStack, useToasts } from "./Toast";
import { ApiError } from "@/lib/api";
import { logout, type PublicUser } from "@/lib/authClient";
import {
  analyzeResume,
  applyAllSuggestions as applyAllSuggestionsApi,
  applySuggestion as applySuggestionApi,
  createResumeFromText,
  downloadResumePdf,
  generateInterviewQuestions as generateInterviewQuestionsApi,
  generateSuggestions as generateSuggestionsApi,
  getAnalysis,
  getOnboarding,
  listResumes,
  matchKeywords as matchKeywordsApi,
  patchResume,
  saveOnboarding,
  uploadResume,
  type Analysis,
  type ExportOptions,
  type InterviewQuestion,
  type KeywordMatch,
  type Profile,
  type Resume,
  type ResumeSections,
  type Suggestion,
} from "@/lib/resumeClient";

type Mode = "onboarding" | "analyzing" | "dashboard";
type UploadTab = "file" | "paste";
type TabKey = "Score" | "Suggestions" | "Interview" | "Keywords";

const BAR_ICON_BY_KEY: Record<string, IconName> = {
  ats: "target",
  content: "file",
  keyword: "key",
  formatting: "layout",
  impact: "light",
};

const EMPTY_SECTIONS: ResumeSections = {
  summary: "",
  experience: "",
  skills: "",
  education: "",
};

const TEMPLATES: ExportOptions["template"][] = ["Modern", "Classic", "Minimal", "ATS-Safe"];
const ACCENT_COLORS = ["#7C3AED", "#06B6D4", "#F43F5E", "#10B981", "#C4B5FD"];
const FONT_OPTIONS = ["Inter", "IBM Plex Sans", "System UI"];

function severityClass(severity: string) {
  return severity.toLowerCase().replace(/\s+/g, "-");
}

function describeScore(score: number) {
  if (score >= 85) return { label: "Standout Candidate", blurb: "You're in the top 5% of applicants." };
  if (score >= 70) return { label: "Strong Candidate", blurb: "You're in the top 15% of applicants." };
  if (score >= 55) return { label: "Solid Draft", blurb: "A few sharpenings away from a top-tier resume." };
  return { label: "Needs Work", blurb: "Let's fix the essentials to move you forward." };
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export default function DashboardApp({ user }: { user: PublicUser }) {
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  // ---- boot + mode -----------------------------------------------------
  const [mode, setMode] = useState<Mode>("onboarding");
  const [booting, setBooting] = useState(true);
  const [messageIndex, setMessageIndex] = useState(0);

  // ---- onboarding form -------------------------------------------------
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [experienceLevel, setExperienceLevel] =
    useState<(typeof experienceLevels)[number]>("1-3 yrs");
  const [industry, setIndustry] = useState(industries[0]);
  const [targetRole, setTargetRole] = useState("");
  const [dreamCompanies, setDreamCompanies] = useState<string[]>([]);
  const [companyInput, setCompanyInput] = useState("");
  const [careerSwitch, setCareerSwitch] = useState(false);
  const [previousField, setPreviousField] = useState("");
  const [resumeType, setResumeType] =
    useState<(typeof resumeTypes)[number]>("Chronological");
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>(
    priorityOptions.slice(0, 4),
  );
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
  const [interviewQuestions, setInterviewQuestions] = useState<InterviewQuestion[]>([]);
  const [interviewLoaded, setInterviewLoaded] = useState(false);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [keywordMatch, setKeywordMatch] = useState<KeywordMatch | null>(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [jobDescription, setJobDescription] = useState("");

  // ---- editor state ----------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>("Score");
  const [editing, setEditing] = useState<ResumeSectionKey | null>(null);
  const [sectionDrafts, setSectionDrafts] = useState<ResumeSections>(EMPTY_SECTIONS);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
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

  // Keep drafts in sync with the loaded resume.
  useEffect(() => {
    if (resume) {
      setSectionDrafts(resume.sections);
      setDirty(false);
    }
  }, [resume?.id, resume?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (profile.experienceLevel) setExperienceLevel(profile.experienceLevel);
          if (profile.industry) setIndustry(profile.industry);
          setTargetRole(profile.targetRole || "");
          setDreamCompanies(profile.dreamCompanies || []);
          setCareerSwitch(Boolean(profile.careerSwitch));
          setPreviousField(profile.previousField || "");
          if (profile.resumeType) setResumeType(profile.resumeType);
          if (profile.priorities?.length) setSelectedPriorities(profile.priorities);
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

  function addCompany() {
    const name = companyInput.trim();
    if (!name) return;
    if (dreamCompanies.includes(name)) {
      setCompanyInput("");
      return;
    }
    setDreamCompanies((list) => [...list, name]);
    setCompanyInput("");
  }

  function removeCompany(name: string) {
    setDreamCompanies((list) => list.filter((c) => c !== name));
  }

  function togglePriority(label: string) {
    setSelectedPriorities((list) =>
      list.includes(label) ? list.filter((p) => p !== label) : [...list, label],
    );
  }

  function goToStep(step: number) {
    setOnboardingStep(Math.max(1, Math.min(4, step)));
  }

  function validateOnboarding(): string | null {
    if (!fullName.trim()) return "Please enter your full name.";
    if (!jobTitle.trim()) return "Please enter your current job title.";
    if (!targetRole.trim()) return "Tell us what role you're aiming for.";
    if (uploadTab === "file" && !file) return "Upload a PDF or DOCX, or switch to paste mode.";
    if (uploadTab === "paste" && pastedText.trim().length < 50)
      return "Paste a bit more of your resume (min 50 characters).";
    return null;
  }

  async function handleAnalyzeFlow() {
    const error = validateOnboarding();
    if (error) {
      push({ kind: "warning", title: "A few details needed", message: error });
      return;
    }
    setSubmitting(true);
    try {
      const profilePayload: Profile = {
        fullName: fullName.trim(),
        jobTitle: jobTitle.trim(),
        experienceLevel,
        industry,
        targetRole: targetRole.trim(),
        dreamCompanies,
        careerSwitch,
        previousField: careerSwitch ? previousField.trim() : "",
        resumeType,
        priorities: selectedPriorities,
      };

      const savePromise = saveOnboarding(profilePayload).catch((err) => {
        push({
          kind: "warning",
          title: "Profile didn't save",
          message: errorMessage(err, "We'll retry on next edit."),
        });
      });

      let newResume: Resume;
      if (uploadTab === "file" && file) {
        const { resume: created } = await uploadResume(file);
        newResume = created;
      } else {
        const name = `${jobTitle.trim() || fullName.trim() || "My"} Resume`;
        const { resume: created } = await createResumeFromText({
          name,
          text: pastedText,
        });
        newResume = created;
      }

      await savePromise;
      setResume(newResume);
      resetDerivedData();
      setMode("analyzing");

      const result = await runAnalyze(newResume.id);
      setMode("dashboard");
      if (result) {
        push({
          kind: "success",
          title: "Analysis complete",
          message: `Overall score: ${result.overallScore}/100`,
        });
      }
    } catch (err) {
      push({
        kind: "error",
        title: "Couldn't start analysis",
        message: errorMessage(err, "Something went wrong — please try again."),
      });
      setMode("onboarding");
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

  // ---- resume editing --------------------------------------------------

  function onSectionChange(section: ResumeSectionKey, value: string) {
    setSectionDrafts((current) => ({ ...current, [section]: value }));
    setDirty(true);
  }

  async function handleSave() {
    if (!resume || saving) return;
    setSaving(true);
    try {
      const { resume: next } = await patchResume(resume.id, sectionDrafts);
      setResume(next);
      setDirty(false);
      push({ kind: "success", title: "Changes saved" });
    } catch (err) {
      push({
        kind: "error",
        title: "Save failed",
        message: errorMessage(err, "Please try saving again."),
      });
    } finally {
      setSaving(false);
    }
  }

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

  // Auto-load tabs the first time they're opened.
  useEffect(() => {
    if (mode !== "dashboard" || !resume) return;
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
    suggestionsLoaded,
    suggestionsLoading,
    interviewLoaded,
    interviewLoading,
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

  const progress = useMemo(() => `${onboardingStep * 25}%`, [onboardingStep]);

  const scoreMeta = analysis ? describeScore(analysis.overallScore) : null;

  const resumeDisplay: ResumeSections = editing
    ? sectionDrafts
    : resume?.sections || EMPTY_SECTIONS;

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

      {mode === "onboarding" && (
        <section className="onboarding-stage" aria-label="ResumeIQ onboarding">
          <div className="wizard-shell">
            <aside className="wizard-rail glass-panel">
              <div className="brand-mark">
                <span className="brand-glyph">
                  <Icon name="spark" />
                </span>
                <strong>ResumeIQ</strong>
              </div>
              {(
                [
                  ["Personal Info", "Current identity"],
                  ["Career Target", "Future goals"],
                  ["Preferences", "AI configuration"],
                  ["Upload", "Final step"],
                ] as const
              ).map(([title, sub], index) => (
                <button
                  type="button"
                  key={title}
                  className={`step-link ${onboardingStep === index + 1 ? "active" : ""}`}
                  onClick={() => goToStep(index + 1)}
                >
                  <span>{index + 1}</span>
                  <b>{title}</b>
                  <small>{sub}</small>
                </button>
              ))}
              <div className="ai-quote">
                <Icon name="spark" />
                <p>
                  &quot;I&apos;ll help optimize for ATS and highlight your hidden executive
                  strengths.&quot;
                </p>
              </div>
            </aside>

            <div className="wizard-main glass-panel">
              <div className="progress-head">
                <span>Step {onboardingStep} of 4</span>
                <b>
                  {["Identity", "Targeting", "Resume preferences", "Completion"][onboardingStep - 1]}
                </b>
              </div>
              <div className="progress-track">
                <span style={{ width: progress }} />
              </div>

              {onboardingStep === 1 && (
                <div className="wizard-content">
                  <header>
                    <h1>Tell us about yourself</h1>
                    <p>
                      Help us tailor your career strategy by defining your current professional
                      landscape.
                    </p>
                  </header>
                  <div className="form-grid">
                    <label>
                      Full name
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alexander Sterling"
                      />
                    </label>
                    <label>
                      Current job title
                      <input
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Senior Product Manager"
                      />
                    </label>
                  </div>
                  <label className="field-label">Experience level</label>
                  <div className="pill-row">
                    {experienceLevels.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={item === experienceLevel ? "selected" : ""}
                        onClick={() => setExperienceLevel(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  <label className="field-label">Industry sector</label>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    {industries.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
              )}

              {onboardingStep === 2 && (
                <div className="wizard-content">
                  <header>
                    <h1>Your target role</h1>
                    <p>Help us understand your career aspirations.</p>
                  </header>
                  <label>
                    What job title are you applying for?
                    <div className="input-with-icon">
                      <input
                        list="roles"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        placeholder="e.g. Senior Product Designer"
                      />
                      <Icon name="search" />
                    </div>
                    <datalist id="roles">
                      {roles.map((role) => (
                        <option key={role} value={role} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Dream companies
                    <div className="tag-input">
                      {dreamCompanies.map((company) => (
                        <span key={company}>
                          {company}
                          <button
                            type="button"
                            aria-label={`Remove ${company}`}
                            onClick={() => removeCompany(company)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        value={companyInput}
                        onChange={(e) => setCompanyInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addCompany();
                          }
                        }}
                        onBlur={addCompany}
                        placeholder="Add company..."
                      />
                    </div>
                  </label>
                  <div className="toggle-card">
                    <div>
                      <b>Are you switching careers?</b>
                      <p>We&apos;ll tailor AI suggestions for transferable skills.</p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={careerSwitch}
                      className={`switch ${careerSwitch ? "on" : ""}`}
                      onClick={() => setCareerSwitch((v) => !v)}
                    >
                      <span />
                    </button>
                  </div>
                  {careerSwitch && (
                    <label>
                      From what field?
                      <input
                        value={previousField}
                        onChange={(e) => setPreviousField(e.target.value)}
                        placeholder="e.g. Graphic Design or Marketing"
                      />
                    </label>
                  )}
                  <div className="insight-card">
                    <Icon name="brain" />
                    <div>
                      <b>AI Concierge Insight</b>
                      <p>
                        Targeting senior roles requires emphasizing leadership outcomes. We&apos;ll
                        extract these signals from your history in the next step.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {onboardingStep === 3 && (
                <div className="wizard-content wide">
                  <header>
                    <h1>Resume preferences</h1>
                    <p>What aspects of your resume should our AI prioritize?</p>
                  </header>
                  <label className="field-label">Select resume type</label>
                  <div className="type-grid">
                    {resumeTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={resumeType === type ? "active" : ""}
                        onClick={() => setResumeType(type)}
                      >
                        <Icon name={resumeTypeCopy[type].icon} />
                        <span />
                        <b>{type}</b>
                        <p>{resumeTypeCopy[type].blurb}</p>
                      </button>
                    ))}
                  </div>
                  <div className="priority-box">
                    <h2>
                      <Icon name="brain" /> AI Analysis Priorities
                    </h2>
                    <div className="check-grid">
                      {priorityOptions.map((priority) => (
                        <label key={priority}>
                          <input
                            type="checkbox"
                            checked={selectedPriorities.includes(priority)}
                            onChange={() => togglePriority(priority)}
                          />
                          <span>{priority}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {onboardingStep === 4 && (
                <div className="wizard-content upload-step">
                  <header>
                    <h1>Upload your Resume</h1>
                    <p>The final step to unlocking your AI-powered career strategy.</p>
                  </header>
                  <div className="upload-tabs">
                    <button
                      type="button"
                      className={uploadTab === "file" ? "active" : ""}
                      onClick={() => setUploadTab("file")}
                    >
                      Upload file
                    </button>
                    <button
                      type="button"
                      className={uploadTab === "paste" ? "active" : ""}
                      onClick={() => setUploadTab("paste")}
                    >
                      Paste resume text
                    </button>
                  </div>
                  {uploadTab === "file" ? (
                    <label className="drop-zone">
                      <Icon name="upload" />
                      <b>{file ? file.name : "Drag & drop your resume here"}</b>
                      <span>Supported formats: PDF, DOCX. Max 5MB.</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const picked = e.target.files?.[0] || null;
                          setFile(picked);
                        }}
                      />
                      <em>{file ? "Change File" : "Browse Files"}</em>
                    </label>
                  ) : (
                    <textarea
                      className="paste-area"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste your full resume text here..."
                      rows={12}
                    />
                  )}
                </div>
              )}

              <footer className="wizard-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => goToStep(onboardingStep - 1)}
                  disabled={submitting || onboardingStep === 1}
                >
                  Back
                </button>
                {onboardingStep < 4 ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => goToStep(onboardingStep + 1)}
                  >
                    Next Step <Icon name="arrow" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-button wide-cta"
                    onClick={handleAnalyzeFlow}
                    disabled={submitting}
                  >
                    {submitting ? "Uploading…" : "Analyze My Resume"} <Icon name="arrow" />
                  </button>
                )}
              </footer>
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
        <section className="dashboard">
          <aside className="sidebar">
            <div className="brand-mark">
              <span className="brand-glyph">
                <Icon name="spark" />
              </span>
              <strong>ResumeIQ</strong>
            </div>
            <nav>
              {(
                [
                  ["grid", "Dashboard"],
                  ["file", "My Resumes"],
                  ["chat", "Interview Prep"],
                  ["history", "History"],
                  ["settings", "Settings"],
                ] as const
              ).map(([icon, label]) => (
                <a className={label === "Dashboard" ? "active" : ""} key={label}>
                  <Icon name={icon as IconName} /> {label}
                </a>
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
              >
                Sign out
              </button>
            </div>
          </aside>

          <section className="resume-workbench">
            <div className="topbar">
              <div>
                <small>Live resume editor</small>
                <h1>{resumeFileName}</h1>
              </div>
              <div className="topbar-actions">
                <button onClick={handleReanalyze} title="Re-run analysis">
                  <Icon name="spark" /> Re-analyze
                </button>
                <button aria-label="Search">
                  <Icon name="search" />
                </button>
                <button aria-label="History">
                  <Icon name="history" />
                </button>
              </div>
            </div>

            <article className="resume-paper">
              <header>
                <h2>{headerName}</h2>
                <p>{targetRole || jobTitle || "Your next role"}</p>
                <span>{user.email}</span>
              </header>

              {(["experience", "summary", "skills", "education"] as ResumeSectionKey[]).map(
                (section) => (
                  <section
                    key={section}
                    className={`resume-section ${editing === section ? "editing" : ""}`}
                    onClick={() => setEditing(section)}
                  >
                    <div className="floating-toolbar" aria-label={`${section} tools`}>
                      <button>
                        <Icon name="edit" /> Edit
                      </button>
                      <button>
                        <Icon name="spark" /> Improve
                      </button>
                    </div>
                    <h3>{section}</h3>
                    {editing === section ? (
                      <textarea
                        value={sectionDrafts[section]}
                        onChange={(e) => onSectionChange(section, e.target.value)}
                        onBlur={() => setEditing(null)}
                        autoFocus
                      />
                    ) : section === "experience" ? (
                      <ul>
                        {(resumeDisplay.experience || "").split("\n").map((line, idx) =>
                          line.trim() ? <li key={`${idx}-${line}`}>{line}</li> : null,
                        )}
                        {!resumeDisplay.experience && (
                          <li className="empty-line">Click to add experience.</li>
                        )}
                      </ul>
                    ) : section === "skills" ? (
                      <div className="skill-tags">
                        {(resumeDisplay.skills || "")
                          .split(/[,\n]/)
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill, idx) => (
                            <span key={`${idx}-${skill}`}>{skill}</span>
                          ))}
                        {!resumeDisplay.skills && (
                          <span className="empty-line">Click to add skills.</span>
                        )}
                      </div>
                    ) : (
                      <p>{resumeDisplay[section] || <em>Click to add {section}.</em>}</p>
                    )}
                  </section>
                ),
              )}

              <button className="download-paper" onClick={() => setDownloadOpen(true)}>
                <Icon name="download" /> Download as PDF
              </button>
            </article>

            {dirty && (
              <button className="save-float" onClick={handleSave} disabled={saving}>
                <Icon name="file" /> {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
          </section>

          <aside className="analysis-panel">
            <div className="tabs">
              {(["Score", "Suggestions", "Interview", "Keywords"] as TabKey[]).map((tab) => (
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
                    {scoreMeta && (
                      <>
                        <h2>&quot;{scoreMeta.label}&quot;</h2>
                        <p>{scoreMeta.blurb}</p>
                      </>
                    )}
                    <div className="score-list">
                      {analysis.bars.map((bar) => (
                        <div key={bar.key}>
                          <span>
                            <Icon name={BAR_ICON_BY_KEY[bar.key] || "target"} /> {bar.label}
                          </span>
                          <b>{bar.value}%</b>
                          <em>
                            <i style={{ width: `${bar.value}%` }} />
                          </em>
                        </div>
                      ))}
                    </div>
                    <h3>What&apos;s Holding You Back</h3>
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
                        <span>{issue.severity}</span>
                        <b>{issue.title}</b>
                        <p>{issue.body}</p>
                        <button
                          onClick={() => {
                            setEditing("experience");
                            setActiveTab("Suggestions");
                            if (!suggestionsLoaded) loadSuggestions();
                          }}
                        >
                          Fix It
                        </button>
                      </div>
                    ))}
                    <h3>What You&apos;re Doing Well</h3>
                    {analysis.wins.length === 0 ? (
                      <div className="win-card">
                        <Icon name="check" /> Strong foundations to build on.
                      </div>
                    ) : (
                      analysis.wins.map((item, idx) => (
                        <div className="win-card" key={`${idx}-${item}`}>
                          <Icon name="check" /> {item}
                        </div>
                      ))
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

            {activeTab === "Suggestions" && (
              <div className="tab-panel">
                {suggestionsLoading && !suggestions.length && (
                  <div className="empty-panel">
                    <p>Generating suggestions…</p>
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
                    <button
                      className="apply-all"
                      onClick={handleApplyAll}
                      disabled={suggestions.every((s) => s.applied)}
                    >
                      Apply All
                    </button>
                    {suggestions.map((suggestion, index) => (
                      <div
                        className={`suggestion-card ${suggestion.applied ? "applied" : ""}`}
                        style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}
                        key={suggestion.id}
                      >
                        <span>{suggestion.section}</span>
                        <del>{suggestion.old}</del>
                        <p>{suggestion.next}</p>
                        <button
                          onClick={() => handleApply(suggestion.id)}
                          disabled={suggestion.applied}
                        >
                          {suggestion.applied ? "Applied" : "Apply"}
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
