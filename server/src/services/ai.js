import { env } from "../config/env.js";
import {
  analyzeResumeHeuristic,
  generateSuggestionsHeuristic,
  generateInterviewQuestionsHeuristic,
  matchKeywordsHeuristic,
  findErrorsHeuristic,
  rewriteErrorHeuristic,
} from "./heuristics.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function hasKey() {
  return Boolean(env.gemini.apiKey);
}

// Call Gemini with JSON schema enforcement. Returns parsed JSON or throws.
async function callGeminiJson({ system, user, schema, maxOutputTokens = 2048 }) {
  const url = `${GEMINI_BASE}/${env.gemini.model}:generateContent?key=${env.gemini.apiKey}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.6,
      maxOutputTokens,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("Gemini: empty response");
  return JSON.parse(raw);
}

// -------- Public API -------- //

export async function analyzeResume(text, opts = {}) {
  if (!hasKey()) return analyzeResumeHeuristic(text, opts);
  try {
    const schema = {
      type: "object",
      properties: {
        overallScore: { type: "integer", minimum: 0, maximum: 100 },
        bars: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              value: { type: "integer", minimum: 0, maximum: 100 },
            },
            required: ["key", "label", "value"],
          },
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["Critical", "Moderate", "Minor"] },
              title: { type: "string" },
              body: { type: "string" },
            },
            required: ["severity", "title", "body"],
          },
        },
        wins: { type: "array", items: { type: "string" } },
      },
      required: ["overallScore", "bars", "issues", "wins"],
    };
    return await callGeminiJson({
      system:
        "You are an expert resume reviewer. Output only JSON matching the schema. " +
        "Score strictly: ATS compatibility, content quality, keyword match, formatting, impact. " +
        "Issues should be specific and actionable.",
      user: `Target role: ${opts.targetRole || "(unspecified)"}\n\nResume text:\n${text}`,
      schema,
    });
  } catch (e) {
    console.warn("[ai] analyze fallback:", e.message);
    return analyzeResumeHeuristic(text, opts);
  }
}

export async function generateSuggestions(resume, _analysis) {
  if (!hasKey()) return generateSuggestionsHeuristic(resume);
  try {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["summary", "experience", "skills", "education"] },
          old: { type: "string" },
          next: { type: "string" },
        },
        required: ["section", "old", "next"],
      },
    };
    const sections = resume.sections;
    return await callGeminiJson({
      system:
        "You rewrite resume lines to be sharper, more specific, metric-driven, and active-voice. " +
        "Each suggestion must quote the original exactly in `old` and propose a replacement in `next`.",
      user:
        `SUMMARY:\n${sections.summary}\n\nEXPERIENCE:\n${sections.experience}\n\nSKILLS:\n${sections.skills}\n\n` +
        `Return 3-6 suggestions.`,
      schema,
    });
  } catch (e) {
    console.warn("[ai] suggestions fallback:", e.message);
    return generateSuggestionsHeuristic(resume);
  }
}

export async function generateInterviewQuestions(text, opts = {}) {
  if (!hasKey()) return generateInterviewQuestionsHeuristic(text, opts);
  try {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          group: {
            type: "string",
            enum: ["Behavioral", "Technical", "Role-Specific", "Culture Fit", "Resume-Based"],
          },
          text: { type: "string" },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
        },
        required: ["group", "text", "difficulty"],
      },
    };
    const count = opts.count || 2;
    return await callGeminiJson({
      system:
        "You generate interview questions grounded in the candidate's resume and target role. " +
        "Return " + (count * 5) + " questions covering all five groups evenly.",
      user: `Target role: ${opts.targetRole || "(unspecified)"}\n\nResume:\n${text}`,
      schema,
      maxOutputTokens: 1800,
    });
  } catch (e) {
    console.warn("[ai] interview fallback:", e.message);
    return generateInterviewQuestionsHeuristic(text, opts);
  }
}

export async function findErrors(text, opts = {}) {
  if (!hasKey()) return findErrorsHeuristic(text, opts);
  try {
    const schema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string", enum: ["summary", "experience", "skills", "education"] },
          line: { type: "string" },
          severity: { type: "string", enum: ["Critical", "Moderate", "Minor"] },
          category: {
            type: "string",
            enum: [
              "grammar",
              "weak-verb",
              "missing-metric",
              "passive-voice",
              "buzzword",
              "formatting",
              "other",
            ],
          },
          reason: { type: "string" },
        },
        required: ["section", "line", "severity", "category", "reason"],
      },
    };
    return await callGeminiJson({
      system:
        "You are a meticulous resume line editor. Find concrete, line-level errors in the resume — " +
        "weak verbs, passive voice, buzzwords, missing metrics, grammar/typos, formatting issues. " +
        "Quote the offending text EXACTLY in `line` so it can be string-matched in the source. " +
        "Each issue must include severity (Critical | Moderate | Minor), a category, and a 1–2 sentence reason. " +
        "Return between 3 and 12 items, focused on the most impactful problems.",
      user: `Target role: ${opts.targetRole || "(unspecified)"}\n\nResume text:\n${text}`,
      schema,
      maxOutputTokens: 2400,
    });
  } catch (e) {
    console.warn("[ai] findErrors fallback:", e.message);
    return findErrorsHeuristic(text, opts);
  }
}

export async function rewriteError(error, resume) {
  if (!hasKey()) return { fix: rewriteErrorHeuristic(error) };
  try {
    const schema = {
      type: "object",
      properties: { fix: { type: "string" } },
      required: ["fix"],
    };
    const sectionText = resume?.sections?.[error.section] || "";
    return await callGeminiJson({
      system:
        "You rewrite a single offending resume line into a sharper, metric-driven, active-voice replacement. " +
        "Return ONLY the replacement text in `fix` — no quotes, no explanation, no labels. " +
        "Keep it concise (under 240 chars) and preserve any factual content from the original.",
      user:
        `Section: ${error.section}\n` +
        `Category: ${error.category}\n` +
        `Severity: ${error.severity}\n` +
        `Why it's wrong: ${error.reason}\n\n` +
        `Offending line:\n${error.line}\n\n` +
        `Surrounding ${error.section} for context:\n${sectionText.slice(0, 1200)}`,
      schema,
      maxOutputTokens: 400,
    });
  } catch (e) {
    console.warn("[ai] rewriteError fallback:", e.message);
    return { fix: rewriteErrorHeuristic(error) };
  }
}

export async function matchKeywords(resumeText, jobDescription) {
  if (!hasKey()) return matchKeywordsHeuristic(resumeText, jobDescription);
  try {
    const schema = {
      type: "object",
      properties: {
        found: { type: "array", items: { type: "string" } },
        missing: { type: "array", items: { type: "string" } },
      },
      required: ["found", "missing"],
    };
    return await callGeminiJson({
      system:
        "Extract the most important skills/keywords from the job description. " +
        "Classify each as present in the resume (`found`) or not (`missing`). Limit to 20 total keywords.",
      user: `JOB DESCRIPTION:\n${jobDescription}\n\nRESUME:\n${resumeText}`,
      schema,
    });
  } catch (e) {
    console.warn("[ai] keywords fallback:", e.message);
    return matchKeywordsHeuristic(resumeText, jobDescription);
  }
}
