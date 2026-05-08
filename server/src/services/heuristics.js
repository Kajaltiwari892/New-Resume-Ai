// Deterministic rule-based fallbacks for when GEMINI_API_KEY is unset.
// Same output shape as the AI-backed versions so routes are provider-agnostic.

const IMPACT_VERBS = [
  "led", "launched", "shipped", "built", "designed", "drove", "increased",
  "reduced", "improved", "grew", "scaled", "architected", "owned", "delivered",
  "spearheaded", "accelerated", "optimized", "migrated", "automated",
];

const LEADERSHIP_KEYWORDS = [
  "strategy", "roadmap", "stakeholder", "cross-functional", "hiring",
  "mentorship", "leadership", "team", "vision", "okrs", "budget",
];

const ATS_FRIENDLY_SECTIONS = ["summary", "experience", "skills", "education"];

function countOccurrences(text, list) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of list) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "gi");
    const matches = lower.match(re);
    if (matches) n += matches.length;
  }
  return n;
}

function hasMetrics(text) {
  return /(\d+%|\d+x|\$\d|\b(million|billion|k)\b|\b\d{2,}\b)/i.test(text);
}

function wordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

export function analyzeResumeHeuristic(text, { targetRole } = {}) {
  const wc = wordCount(text);
  const impact = countOccurrences(text, IMPACT_VERBS);
  const leadership = countOccurrences(text, LEADERSHIP_KEYWORDS);
  const metrics = hasMetrics(text);

  const atsScore = Math.min(
    100,
    60 + (ATS_FRIENDLY_SECTIONS.filter((s) => new RegExp(s, "i").test(text)).length * 10),
  );
  const contentScore = Math.min(100, 40 + impact * 4 + (metrics ? 15 : 0));
  const keywordScore = targetRole
    ? Math.min(100, 50 + countOccurrences(text, targetRole.toLowerCase().split(/\s+/)) * 8)
    : 60;
  const formattingScore = wc > 120 && wc < 900 ? 90 : 70;
  const impactScore = Math.min(100, 30 + impact * 5 + (metrics ? 25 : 0));

  const overallScore = Math.round(
    (atsScore + contentScore + keywordScore + formattingScore + impactScore) / 5,
  );

  const bars = [
    { key: "ats", label: "ATS Compatibility", value: atsScore },
    { key: "content", label: "Content Quality", value: contentScore },
    { key: "keywords", label: "Keyword Match", value: keywordScore },
    { key: "formatting", label: "Formatting", value: formattingScore },
    { key: "impact", label: "Impact Score", value: impactScore },
  ];

  const issues = [];
  if (!metrics) {
    issues.push({
      severity: "Critical",
      title: "Vague impact claims",
      body: "Add numbers or percentages to at least three bullets — e.g. retention, revenue, time saved, scale.",
    });
  }
  if (leadership < 2) {
    issues.push({
      severity: "Moderate",
      title: "Missing leadership keywords",
      body: "Include words like strategy, roadmap, stakeholder, and cross-functional where they apply.",
    });
  }
  if (impact < 3) {
    issues.push({
      severity: "Moderate",
      title: "Weak action verbs",
      body: "Start more bullets with strong verbs: led, launched, shipped, scaled, drove.",
    });
  }
  if (wc < 120) {
    issues.push({
      severity: "Minor",
      title: "Resume looks short",
      body: "Add context for your most recent role — outcomes, team size, technologies.",
    });
  }

  const wins = [];
  if (atsScore >= 80) wins.push("ATS-friendly section structure");
  if (metrics) wins.push("Quantified outcomes present");
  if (impact >= 4) wins.push("Strong verb variety");
  if (wins.length === 0) wins.push("Clear foundation to build on");

  return { overallScore, bars, issues, wins };
}

export function generateSuggestionsHeuristic(resume) {
  const out = [];
  const exp = resume.sections.experience || "";
  const summary = resume.sections.summary || "";
  const skills = resume.sections.skills || "";

  // Experience — weak phrases
  const weakPhrases = [
    {
      match: /worked on ([^.\n]+)/i,
      rewrite: (m) =>
        `Led ${m[1].trim()} and delivered measurable outcomes for the business.`,
    },
    {
      match: /helped (?:with )?([^.\n]+)/i,
      rewrite: (m) => `Partnered on ${m[1].trim()} — drove the decisions that shipped.`,
    },
    {
      match: /(responsible for [^.\n]+)/i,
      rewrite: (m) =>
        `Owned ${m[1].replace(/responsible for\s*/i, "").trim()} end-to-end.`,
    },
  ];
  for (const { match, rewrite } of weakPhrases) {
    const m = exp.match(match);
    if (m) {
      out.push({
        section: "experience",
        old: m[0],
        next: rewrite(m),
      });
    }
    if (out.length >= 3) break;
  }

  // Summary — if it reads generically
  if (summary && /experienced|passionate|hard[- ]working|team player/i.test(summary)) {
    out.push({
      section: "summary",
      old: summary.slice(0, 140),
      next:
        "Product-minded engineer/designer turning complex problems into measurable outcomes — ship velocity, retention, and revenue.",
    });
  }

  // Skills — repetition
  const skillTokens = skills.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const dupes = skillTokens.filter((t, i) => skillTokens.indexOf(t) !== i);
  if (dupes.length) {
    out.push({
      section: "skills",
      old: skills,
      next: Array.from(new Set(skillTokens)).join(", "),
    });
  }

  // If nothing found, give one generic tightening tip
  if (out.length === 0 && exp) {
    out.push({
      section: "experience",
      old: exp.split("\n")[0] || exp.slice(0, 140),
      next:
        (exp.split("\n")[0] || "").replace(/^\w/, (c) => c.toUpperCase()) +
        " — quantified with a specific metric (e.g. 30% improvement, 2x faster, 1M users).",
    });
  }

  return out.slice(0, 6);
}

const QUESTION_POOL = {
  Behavioral: [
    "Tell me about a time you influenced a senior stakeholder without formal authority.",
    "Describe a project that failed and what you changed afterward.",
    "How do you handle disagreement with a peer over technical direction?",
    "Walk me through feedback that reshaped how you work.",
  ],
  Technical: [
    "How would you evaluate the quality of a feature you shipped three months ago?",
    "What trade-offs do you weigh when choosing between two architectures?",
    "Explain a system you built end-to-end and the hardest decision in it.",
    "How do you decide what tests are worth writing?",
  ],
  "Role-Specific": [
    "Walk through the product/engineering trade-offs behind your most recent launch.",
    "How do you prioritize a backlog when everything feels critical?",
    "Give an example where scope cuts led to a better outcome.",
    "Describe how you measure success in your current role.",
  ],
  "Culture Fit": [
    "What operating cadence brings out your best cross-functional work?",
    "Describe the kind of team you most want to be part of.",
    "When have you raised a concern to someone more senior?",
    "What's one team norm you'd import from a past job?",
  ],
  "Resume-Based": [
    "Your resume highlights a specific metric — what changed after that launch?",
    "Pick the project you're proudest of. What would you do differently?",
    "Which bullet point best represents how you work?",
    "What's missing from your resume that you wish people asked about?",
  ],
};

export function generateInterviewQuestionsHeuristic(_text, { count = 2 } = {}) {
  const result = [];
  for (const [group, pool] of Object.entries(QUESTION_POOL)) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const take = shuffled.slice(0, count);
    take.forEach((q, i) =>
      result.push({
        group,
        text: q,
        difficulty: i % 2 === 0 ? "Medium" : "Hard",
      }),
    );
  }
  return result;
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our", "that", "this",
  "will", "have", "has", "from", "who", "what", "when", "about", "into", "not",
  "their", "them", "they", "its", "it's", "be", "or", "to", "a", "an", "of",
  "in", "on", "at", "is", "as", "by", "we", "us", "any", "all", "such", "per",
  "experience", "job", "role", "team", "working", "work", "ability",
]);

function extractKeywords(text) {
  const tokens = (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([w]) => w);
}

export function matchKeywordsHeuristic(resumeText, jobDescription) {
  const wanted = extractKeywords(jobDescription);
  const resumeLower = (resumeText || "").toLowerCase();
  const found = [];
  const missing = [];
  for (const w of wanted) {
    if (resumeLower.includes(w)) found.push(w);
    else missing.push(w);
  }
  return { found, missing };
}
