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
      temperature: 0.3,
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

// -------- FAANG-Grade System Prompt -------- //

const FAANG_SYSTEM_PROMPT = `You are an elite resume screening AI trained on hiring standards from FAANG companies, top consulting firms (McKinsey, BCG, Bain), and Fortune 500 recruiting teams. You review resumes with the same ruthlessness as a senior recruiter who rejects 95% of applications in under 10 seconds.

SCORING CRITERIA (Total: 100 points). Be HARSH. Most resumes should score between 40–70.

1. IMPACT & QUANTIFICATION (25 points)
- Every bullet must answer: "So what? How much? How many? How fast?"
- Deduct 3 points per bullet missing a metric (%, $, time saved, users, scale)
- Deduct 5 points if the WHOLE experience section has fewer than 3 numbers
- Flag every single bullet that has NO number as a critical issue

2. ACTION VERB STRENGTH (15 points)
- BANNED WEAK VERBS (deduct 2 each): worked, helped, assisted, was responsible for, participated, involved, contributed, did, made, handled, supported, used, utilized, tried, learned, gained experience, exposed to, familiar with, knowledge of, aware of
- REQUIRED STRONG VERBS: Architected, Engineered, Spearheaded, Orchestrated, Launched, Drove, Reduced, Increased, Optimized, Automated, Refactored, Deployed, Migrated, Designed, Built, Scaled, Eliminated, Streamlined, Accelerated, Pioneered
- Deduct 3 points if more than 2 bullets start with the same verb
- Deduct 2 points for passive voice

3. BULLET POINT QUALITY & STRUCTURE (15 points)
Ideal formula: [Strong Verb] + [What you did] + [How/Technology] + [Result/Impact]
- Bullet over 35 words: -2 pts
- Bullet under 8 words: -2 pts
- Bullet that is job description not achievement: -3 pts
- More than 6 bullets per role: -1 pt
- Fewer than 2 bullets for a role lasting 6+ months: -2 pts
- Bullets that start with "I": -2 pts

4. ATS & KEYWORD OPTIMIZATION (15 points)
- Missing LinkedIn URL: -3 pts
- Missing GitHub (for technical roles): -2 pts
- Skills shown only as comma list with no context: -2 pts
- No mention of team size or scope: -2 pts
- Technologies in skills but NEVER in experience bullets: -3 pts
- Job title doesn't match industry standard: -2 pts
- No location or "Remote" specified: -1 pt

5. LEADERSHIP & SCOPE SIGNALS (10 points)
- No mention of cross-team collaboration: -2 pts
- No end-to-end project ownership: -3 pts
- No mentoring/code review/leading others (for 3+ yrs exp): -2 pts
- Bullets describe tasks but never system or product impact: -3 pts

6. FORMATTING & CONSISTENCY (10 points)
- Mixed date formats: -2 pts
- Inconsistent punctuation in bullets: -2 pts
- Company name inconsistent: -1 pt
- Missing end date or "Present" for current role: -2 pts
- Unexplained gaps over 3 months: -2 pts

7. SUMMARY / OBJECTIVE SECTION (5 points)
- Contains "Passionate developer/designer..." → -5 pts
- "I am a hardworking..." → -5 pts
- "Looking to leverage..." → -5 pts
- "Seeking a challenging opportunity..." → -5 pts
- Over 4 lines long: -3 pts
- No summary for 2+ years experience: -3 pts
Good summary = Years of experience + Core specialization + 1-2 achievements + value add

8. PROJECTS & PROOF OF WORK (5 points)
- Project with no link: -2 pts
- Reads like tutorial copy-paste ("Built a CRUD app", "Todo app"): -3 pts
- No mention of scale, users, or technical challenge: -2 pts
- No projects for <2 years experience: -4 pts

EXTRA DEDUCTIONS:
- Resume over 2 pages for under 10 years experience: -5 pts
- Photo on resume (US/UK roles): -3 pts
- References section: -3 pts
- Spelling/grammar error: -5 pts each (max -15)
- First person anywhere: -3 pts

Output ONLY valid JSON matching the schema. Be specific, cite exact text from the resume, and be brutally honest.`;

// -------- Public API -------- //

export async function analyzeResume(text, opts = {}) {
  if (!hasKey()) return analyzeResumeHeuristic(text, opts);
  try {
    const schema = {
      type: "object",
      properties: {
        overall_score: { type: "integer", minimum: 0, maximum: 100 },
        grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
        verdict: { type: "string" },
        dimension_scores: {
          type: "object",
          properties: {
            impact_quantification: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 25 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            action_verbs: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 15 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            bullet_quality: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 15 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            ats_keywords: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 15 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            leadership_scope: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 10 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            formatting: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 10 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            summary: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 5 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
            projects: {
              type: "object",
              properties: {
                score: { type: "integer", minimum: 0, maximum: 5 },
                max: { type: "integer" },
              },
              required: ["score", "max"],
            },
          },
          required: [
            "impact_quantification",
            "action_verbs",
            "bullet_quality",
            "ats_keywords",
            "leadership_scope",
            "formatting",
            "summary",
            "projects",
          ],
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              severity: { type: "string", enum: ["critical", "moderate", "minor"] },
              category: {
                type: "string",
                enum: [
                  "impact",
                  "verb",
                  "structure",
                  "ats",
                  "leadership",
                  "formatting",
                  "summary",
                  "project",
                ],
              },
              title: { type: "string" },
              description: { type: "string" },
              original_text: { type: "string" },
              location: { type: "string" },
              fix_instruction: { type: "string" },
              example_fix: { type: "string" },
            },
            required: [
              "id",
              "severity",
              "category",
              "title",
              "description",
              "original_text",
              "location",
              "fix_instruction",
              "example_fix",
            ],
          },
        },
        positives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "description"],
          },
        },
        top_3_priorities: {
          type: "array",
          items: { type: "string" },
        },
        interview_red_flags: {
          type: "array",
          items: { type: "string" },
        },
        ats_pass_probability: { type: "string", enum: ["low", "medium", "high"] },
        estimated_interview_rate: { type: "string" },
      },
      required: [
        "overall_score",
        "grade",
        "verdict",
        "dimension_scores",
        "issues",
        "positives",
        "top_3_priorities",
        "interview_red_flags",
        "ats_pass_probability",
        "estimated_interview_rate",
      ],
    };

    const result = await callGeminiJson({
      system: FAANG_SYSTEM_PROMPT,
      user: `Target role: ${opts.targetRole || "(unspecified)"}\n\nRESUME TEXT:\n${text}`,
      schema,
      maxOutputTokens: 4096,
    });

    // Derive bars from dimension_scores for backward compat display
    const ds = result.dimension_scores;
    const bars = [
      { key: "impact", label: "Impact & Metrics", value: Math.round((ds.impact_quantification.score / ds.impact_quantification.max) * 100) },
      { key: "verb", label: "Action Verbs", value: Math.round((ds.action_verbs.score / ds.action_verbs.max) * 100) },
      { key: "bullet", label: "Bullet Quality", value: Math.round((ds.bullet_quality.score / ds.bullet_quality.max) * 100) },
      { key: "ats", label: "ATS Keywords", value: Math.round((ds.ats_keywords.score / ds.ats_keywords.max) * 100) },
      { key: "leadership", label: "Leadership", value: Math.round((ds.leadership_scope.score / ds.leadership_scope.max) * 100) },
      { key: "formatting", label: "Formatting", value: Math.round((ds.formatting.score / ds.formatting.max) * 100) },
      { key: "summary", label: "Summary", value: Math.round((ds.summary.score / ds.summary.max) * 100) },
      { key: "projects", label: "Projects", value: Math.round((ds.projects.score / ds.projects.max) * 100) },
    ];

    // Normalize issues to unified shape
    const issues = (result.issues || []).map((issue) => ({
      severity: capitalize(issue.severity), // Critical | Moderate | Minor
      title: issue.title,
      body: issue.description,
      id: issue.id,
      category: issue.category,
      description: issue.description,
      original_text: issue.original_text,
      location: issue.location,
      fix_instruction: issue.fix_instruction,
      example_fix: issue.example_fix,
    }));

    return {
      overallScore: result.overall_score,
      grade: result.grade,
      verdict: result.verdict,
      bars,
      issues,
      wins: (result.positives || []).map((p) => p.title),
      dimensionScores: result.dimension_scores,
      positives: result.positives || [],
      top3Priorities: result.top_3_priorities || [],
      interviewRedFlags: result.interview_red_flags || [],
      atsPassProbability: result.ats_pass_probability,
      estimatedInterviewRate: result.estimated_interview_rate,
    };
  } catch (e) {
    console.warn("[ai] analyze fallback:", e.message);
    return analyzeResumeHeuristic(text, opts);
  }
}

function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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
        "You are an elite resume coach trained on FAANG hiring standards. " +
        "Rewrite resume bullets to be sharper, metric-driven, and achievement-focused using strong action verbs. " +
        "Each suggestion must quote the EXACT original text in `old` and provide a significantly improved replacement in `next`. " +
        "Focus on: adding quantifiable metrics, replacing weak verbs, strengthening impact statements. " +
        "Return 5-8 high-impact suggestions.",
      user:
        `SUMMARY:\n${sections.summary}\n\nEXPERIENCE:\n${sections.experience}\n\nSKILLS:\n${sections.skills}\n\n` +
        `Return 5-8 specific, impactful suggestions.`,
      schema,
      maxOutputTokens: 2400,
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
