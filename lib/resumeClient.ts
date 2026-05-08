"use client";

import { api, API_BASE, getAccessToken } from "./api";

export type ExperienceLevel = "Fresher" | "1-3 yrs" | "3-7 yrs" | "7+ yrs";
export type ResumeType = "Chronological" | "Functional" | "Hybrid";

export type Profile = {
  fullName?: string;
  jobTitle?: string;
  experienceLevel?: ExperienceLevel;
  industry?: string;
  targetRole?: string;
  dreamCompanies?: string[];
  careerSwitch?: boolean;
  previousField?: string;
  resumeType?: ResumeType;
  priorities?: string[];
};

export type ResumeSections = {
  summary: string;
  experience: string;
  skills: string;
  education: string;
};

export type Resume = {
  id: string;
  name: string;
  source: "file" | "paste";
  mimeType?: string;
  sections: ResumeSections;
  rawText?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AnalysisBar = { key: string; label: string; value: number };
export type AnalysisIssue = {
  id?: string;
  severity: "Critical" | "Moderate" | "Minor";
  title: string;
  body: string;
};

export type Analysis = {
  id: string;
  resumeId: string;
  overallScore: number;
  bars: AnalysisBar[];
  issues: AnalysisIssue[];
  wins: string[];
  createdAt: string;
};

export type Suggestion = {
  id: string;
  analysisId: string;
  resumeId: string;
  section: keyof ResumeSections;
  old: string;
  next: string;
  applied: boolean;
  appliedAt?: string | null;
};

export type InterviewQuestion = {
  id: string;
  resumeId: string;
  group: "Behavioral" | "Technical" | "Role-Specific" | "Culture Fit" | "Resume-Based";
  text: string;
  difficulty: "Easy" | "Medium" | "Hard";
  ready: boolean;
  createdAt: string;
};

export type KeywordMatch = {
  id: string;
  resumeId: string;
  jobDescription: string;
  found: string[];
  missing: string[];
  createdAt: string;
};

// --- Onboarding --------------------------------------------------------

export function getOnboarding() {
  return api<{ profile: Profile | null }>("/api/onboarding", { auth: true });
}

export function saveOnboarding(input: Profile) {
  return api<{ profile: Profile }>("/api/onboarding", {
    method: "PUT",
    auth: true,
    json: input,
  });
}

// --- Resumes -----------------------------------------------------------

export function listResumes() {
  return api<{ resumes: Resume[] }>("/api/resumes", { auth: true });
}

export function getResume(id: string) {
  return api<{ resume: Resume }>(`/api/resumes/${id}`, { auth: true });
}

export function createResumeFromText(input: { name: string; text: string }) {
  return api<{ resume: Resume }>("/api/resumes", {
    method: "POST",
    auth: true,
    json: input,
  });
}

export async function uploadResume(file: File, name?: string) {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);

  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/api/resumes/upload`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (res.status === 401) {
    const { refresh } = await import("./authClient");
    const newToken = await refresh();
    if (newToken) return uploadResume(file, name);
  }

  if (!res.ok) {
    let msg = res.statusText;
    let code = "UNKNOWN";
    let details: unknown;
    try {
      const body = await res.json();
      msg = body?.error?.message || msg;
      code = body?.error?.code || code;
      details = body?.error?.details;
    } catch {
      /* no-op */
    }
    const { ApiError } = await import("./api");
    throw new ApiError(res.status, code, msg, details);
  }

  return (await res.json()) as { resume: Resume };
}

export function patchResume(
  id: string,
  input: Partial<ResumeSections> & { name?: string },
) {
  return api<{ resume: Resume }>(`/api/resumes/${id}`, {
    method: "PATCH",
    auth: true,
    json: input,
  });
}

export function deleteResume(id: string) {
  return api<void>(`/api/resumes/${id}`, { method: "DELETE", auth: true });
}

// --- Analysis ----------------------------------------------------------

export function analyzeResume(id: string) {
  return api<{ analysis: Analysis }>(`/api/resumes/${id}/analyze`, {
    method: "POST",
    auth: true,
  });
}

export function getAnalysis(id: string) {
  return api<{ analysis: Analysis | null }>(`/api/resumes/${id}/analysis`, {
    auth: true,
  });
}

// --- Suggestions -------------------------------------------------------

export function generateSuggestions(id: string) {
  return api<{ suggestions: Suggestion[] }>(`/api/resumes/${id}/suggestions`, {
    method: "POST",
    auth: true,
  });
}

export function applySuggestion(resumeId: string, suggestionId: string) {
  return api<{ suggestion: Suggestion; resume: Resume }>(
    `/api/resumes/${resumeId}/suggestions/${suggestionId}/apply`,
    { method: "POST", auth: true },
  );
}

export function applyAllSuggestions(resumeId: string) {
  return api<{ suggestions: Suggestion[]; resume: Resume }>(
    `/api/resumes/${resumeId}/suggestions/apply-all`,
    { method: "POST", auth: true },
  );
}

// --- Interview ---------------------------------------------------------

export function generateInterviewQuestions(id: string, count = 5) {
  return api<{ questions: InterviewQuestion[] }>(`/api/resumes/${id}/interview`, {
    method: "POST",
    auth: true,
    json: { count },
  });
}

// --- Keywords ----------------------------------------------------------

export function matchKeywords(id: string, jobDescription: string) {
  return api<{ match: KeywordMatch }>(`/api/resumes/${id}/keywords`, {
    method: "POST",
    auth: true,
    json: { jobDescription },
  });
}

// --- Export ------------------------------------------------------------

export type ExportOptions = {
  template?: "Modern" | "Classic" | "Minimal" | "ATS-Safe";
  font?: string;
  accent?: string;
  includeAiSummary?: boolean;
};

export async function downloadResumePdf(id: string, opts: ExportOptions = {}) {
  const token = getAccessToken();
  const qs = new URLSearchParams();
  if (opts.template) qs.set("template", opts.template);
  if (opts.font) qs.set("font", opts.font);
  if (opts.accent) qs.set("accent", opts.accent);
  if (opts.includeAiSummary === false) qs.set("includeAiSummary", "false");
  const query = qs.toString();
  const res = await fetch(
    `${API_BASE}/api/resumes/${id}/export${query ? `?${query}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );

  if (res.status === 401) {
    const { refresh } = await import("./authClient");
    const newToken = await refresh();
    if (newToken) return downloadResumePdf(id, opts);
  }

  if (!res.ok) {
    let msg = res.statusText;
    let code = "UNKNOWN";
    try {
      const body = await res.json();
      msg = body?.error?.message || msg;
      code = body?.error?.code || code;
    } catch {
      /* no-op */
    }
    const { ApiError } = await import("./api");
    throw new ApiError(res.status, code, msg);
  }

  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || "resume.pdf";
  const blob = await res.blob();
  return { blob, filename };
}
