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
  const seen = new Set();
  const push = (s) => {
    const key = `${s.section}::${s.old.trim().slice(0, 80)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  const exp = resume.sections.experience || "";
  const summary = resume.sections.summary || "";
  const skills = resume.sections.skills || "";
  const education = resume.sections.education || "";

  // ---- Experience: per-line scan ---------------------------------------
  const expLines = exp.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const weakVerbRules = [
    {
      re: /\bworked on\s+([^.\n]+)/i,
      rewrite: (m, line) =>
        line.replace(m[0], `Led ${m[1].trim()}`) + (/\d/.test(line) ? "" : " — quantify the outcome (%, $, users, time)."),
    },
    {
      re: /\bhelped (?:with\s+)?([^.\n]+)/i,
      rewrite: (m, line) =>
        line.replace(m[0], `Drove ${m[1].trim()}`) + (/\d/.test(line) ? "" : " — name what shipped and the measurable impact."),
    },
    {
      re: /\bresponsible for\s+([^.\n]+)/i,
      rewrite: (m, line) => line.replace(m[0], `Owned ${m[1].trim()} end-to-end`),
    },
    {
      re: /\bassisted (?:in|with)?\s*([^.\n]+)/i,
      rewrite: (m, line) =>
        line.replace(m[0], `Partnered on ${m[1].trim()}`) + " — call out the part you led.",
    },
    {
      re: /\bparticipated in\s+([^.\n]+)/i,
      rewrite: (m, line) => line.replace(m[0], `Contributed to ${m[1].trim()}`) + " — be specific about your contribution.",
    },
    {
      re: /\bin charge of\s+([^.\n]+)/i,
      rewrite: (m, line) => line.replace(m[0], `Led ${m[1].trim()}`),
    },
    {
      re: /\b(?:was|am)\s+(?:tasked with|involved in)\s+([^.\n]+)/i,
      rewrite: (m, line) => line.replace(m[0], `Delivered ${m[1].trim()}`),
    },
    {
      re: /\bduties included\b\s*([^.\n]+)?/i,
      rewrite: (m, line) =>
        line.replace(m[0], `Drove ${(m[1] || "").trim()}`).trim() + " — frame as outcomes, not duties.",
    },
  ];

  // Passive voice — "was/were ___ed by ___"
  const passiveRe = /\b(was|were)\s+(\w+ed)\s+by\s+([^.,\n]+)/i;

  // Buzzwords
  const buzzwordRe = /\b(team player|hard[- ]?working|detail[- ]?oriented|go[- ]?getter|synergy|results[- ]?driven|self[- ]?starter|think outside the box|out of the box|guru|rockstar|ninja|wheelhouse)\b/gi;

  for (const line of expLines) {
    if (out.length >= 8) break;

    // Weak verbs
    for (const { re, rewrite } of weakVerbRules) {
      const m = line.match(re);
      if (m) {
        push({ section: "experience", old: line, next: rewrite(m, line) });
        break;
      }
    }

    // Passive voice
    const pm = line.match(passiveRe);
    if (pm) {
      const next = line.replace(passiveRe, (_all, _be, verb, agent) => `${agent.trim()} ${verb}`);
      push({
        section: "experience",
        old: line,
        next: next.replace(/^\w/, (c) => c.toUpperCase()) + " — active voice puts you as the doer.",
      });
    }

    // Missing metric in a substantive bullet
    if (
      line.length > 30 &&
      /^[\s•\-*\d.]*[A-Za-z]/.test(line) &&
      !/\d/.test(line) &&
      !/(summary|experience|skills|education)/i.test(line)
    ) {
      push({
        section: "experience",
        old: line,
        next:
          line.replace(/[.\s]+$/, "") +
          " — add a metric (e.g. 30% improvement, 2x faster, 1M users, $250K saved).",
      });
    }

    // Buzzwords inside experience
    if (buzzwordRe.test(line)) {
      buzzwordRe.lastIndex = 0;
      push({
        section: "experience",
        old: line,
        next: line.replace(buzzwordRe, "[replace with a concrete behavior + outcome]"),
      });
    }
    buzzwordRe.lastIndex = 0;
  }

  // ---- Summary ---------------------------------------------------------
  if (summary) {
    const wc = wordCount(summary);
    const trimmed = summary.trim();
    if (/(experienced|passionate|hard[- ]?working|team player|motivated|results[- ]?driven|self[- ]?starter)/i.test(trimmed)) {
      push({
        section: "summary",
        old: trimmed.slice(0, 200),
        next:
          "Replace generic adjectives with one sharp positioning line: role + scope + the outcome you're known for. Example: \"Senior product engineer who shipped 3 zero-to-one launches and grew weekly active users 4×.\"",
      });
    }
    if (wc < 18) {
      push({
        section: "summary",
        old: trimmed,
        next:
          (trimmed || "Add a 2–3 sentence summary") +
          " — expand to 30–60 words: who you are, scope of impact, one signature accomplishment.",
      });
    } else if (wc > 90) {
      push({
        section: "summary",
        old: trimmed.slice(0, 200),
        next: "Tighten to 30–60 words. A summary is a hook, not a bio — cut adjectives, keep the highest-leverage facts.",
      });
    }
    if (!/\d/.test(trimmed) && wc >= 18) {
      push({
        section: "summary",
        old: trimmed.slice(0, 200),
        next: "Bake one specific number into the summary (years, scale, %, $, users) so a recruiter has something concrete to anchor on.",
      });
    }
  } else {
    push({
      section: "summary",
      old: "",
      next: "Add a 2–3 sentence summary at the top: role, scope, and one quantified accomplishment that frames the rest of your resume.",
    });
  }

  // ---- Skills ----------------------------------------------------------
  if (skills) {
    const skillTokens = skills.split(/[,\n;|]/).map((s) => s.trim()).filter(Boolean);
    const dupes = skillTokens.filter((t, i) => skillTokens.findIndex((x) => x.toLowerCase() === t.toLowerCase()) !== i);
    if (dupes.length) {
      const deduped = [];
      const seenLower = new Set();
      for (const t of skillTokens) {
        const k = t.toLowerCase();
        if (!seenLower.has(k)) {
          seenLower.add(k);
          deduped.push(t);
        }
      }
      push({
        section: "skills",
        old: skills,
        next: deduped.join(", "),
      });
    }
    if (skillTokens.length < 6) {
      push({
        section: "skills",
        old: skills,
        next:
          (skills.replace(/[.\s]+$/, "") || "[your skills]") +
          " — list 8–15 skills grouped (e.g. Languages, Frameworks, Tools, Cloud) so ATS keyword matching has something to grab.",
      });
    }
    if (skillTokens.length > 25) {
      push({
        section: "skills",
        old: skills,
        next: "Trim to your top 12–18 skills. A long unfiltered list signals lack of focus and dilutes keyword weight.",
      });
    }
  } else {
    push({
      section: "skills",
      old: "",
      next: "Add a Skills section grouped by category (Languages, Frameworks, Tools, Cloud). Aim for 8–15 keywords pulled from the roles you're targeting.",
    });
  }

  // ---- Education -------------------------------------------------------
  if (education) {
    if (!/\b(19|20)\d{2}\b/.test(education)) {
      push({
        section: "education",
        old: education.slice(0, 200),
        next:
          education.replace(/[.\s]+$/, "") +
          " — add graduation year (or expected year) so recruiters can place your experience on a timeline.",
      });
    }
  }

  // ---- Fallback --------------------------------------------------------
  if (out.length === 0 && exp) {
    push({
      section: "experience",
      old: expLines[0] || exp.slice(0, 140),
      next:
        (expLines[0] || "").replace(/^\w/, (c) => c.toUpperCase()) +
        " — quantify with a specific metric (e.g. 30% improvement, 2x faster, 1M users).",
    });
  }

  return out.slice(0, 10);
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

export function generateInterviewQuestionsHeuristic(
  _text,
  { count = 5, difficulty, group, withAnswers = true } = {},
) {
  const result = [];
  const groups = group ? [group] : Object.keys(QUESTION_POOL);
  // When no group filter, distribute the requested count across groups instead
  // of taking `count` from each one (which over-produced 5× the asked amount).
  const perGroup = group
    ? count
    : Math.max(1, Math.ceil(count / groups.length));

  for (const g of groups) {
    const pool = QUESTION_POOL[g];
    if (!pool) continue;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const take = shuffled.slice(0, perGroup);
    take.forEach((q, i) => {
      const d =
        difficulty && difficulty !== "Mixed"
          ? difficulty
          : i === 0
            ? "Easy"
            : i % 2 === 0
              ? "Medium"
              : "Hard";
      result.push({
        group: g,
        text: q,
        difficulty: d,
        ...(withAnswers
          ? {
              answer:
                "Sample answer unavailable in offline mode — set GEMINI_API_KEY on the server to get AI-generated model answers. " +
                "For now, structure your reply: (1) restate the situation, (2) explain what you did and why, (3) cite a measurable outcome.",
            }
          : {}),
      });
    });
  }
  // Trim to exactly the requested total when distributing across groups.
  return group ? result : result.slice(0, count);
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

// ---- Errors (line-level diagnostics) -----------------------------------

const SECTION_HEADERS = [
  { key: "summary", re: /^\s*(summary|objective|profile)\b/i },
  { key: "experience", re: /^\s*(experience|work\s+experience|employment)\b/i },
  { key: "skills", re: /^\s*(skills|technical\s+skills)\b/i },
  { key: "education", re: /^\s*(education|academic)\b/i },
];

const ERROR_RULES = [
  {
    re: /\bworked on\b/i,
    severity: "Moderate",
    category: "weak-verb",
    reason: "\"Worked on\" is vague — replace with a stronger active verb (Led, Built, Shipped) and quantify the outcome.",
  },
  {
    re: /\bhelped (?:with )?/i,
    severity: "Moderate",
    category: "weak-verb",
    reason: "\"Helped\" understates your role. State what you actually delivered.",
  },
  {
    re: /\bresponsible for\b/i,
    severity: "Moderate",
    category: "weak-verb",
    reason: "\"Responsible for\" is passive. Lead with an action verb that names the result.",
  },
  {
    re: /\b(was|were)\s+\w+ed\s+by\b/i,
    severity: "Minor",
    category: "passive-voice",
    reason: "Passive voice. Rewrite in active voice with you as the subject.",
  },
  {
    re: /\b(team player|hard[- ]?working|detail[- ]?oriented|go[- ]?getter|synergy|results[- ]?driven)\b/i,
    severity: "Minor",
    category: "buzzword",
    reason: "Generic buzzword. Replace with a concrete behavior backed by an outcome.",
  },
  {
    re: /\b(passionate|motivated)\b/i,
    severity: "Minor",
    category: "buzzword",
    reason: "Vague self-description. Show passion through a specific project or metric instead.",
  },
];

function detectSection(line, current) {
  for (const h of SECTION_HEADERS) {
    if (h.re.test(line)) return h.key;
  }
  return current;
}

function looksLikeBullet(line) {
  return /^[\s•\-*\d.]*\S/.test(line) && line.trim().length > 0;
}

export function findErrorsHeuristic(text) {
  const lines = (text || "").split(/\r?\n/);
  const out = [];
  let section = "experience";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const next = detectSection(line, section);
    if (next !== section) {
      section = next;
      continue; // header itself isn't an error
    }

    let matched = false;
    for (const rule of ERROR_RULES) {
      if (rule.re.test(line)) {
        out.push({
          section,
          line,
          severity: rule.severity,
          category: rule.category,
          reason: rule.reason,
        });
        matched = true;
        break;
      }
    }

    // Experience bullet without any digit → missing metric
    if (
      !matched &&
      section === "experience" &&
      looksLikeBullet(line) &&
      line.length > 25 &&
      !/\d/.test(line)
    ) {
      out.push({
        section,
        line,
        severity: "Moderate",
        category: "missing-metric",
        reason: "No numbers in this bullet. Add a metric (%, $, scale, time saved) to make impact concrete.",
      });
    }

    if (out.length >= 12) break;
  }
  return out;
}

export function rewriteErrorHeuristic(error) {
  const original = error.line || "";
  switch (error.category) {
    case "weak-verb": {
      let next = original
        .replace(/\bworked on\b/i, "Led")
        .replace(/\bhelped with\b/i, "Drove")
        .replace(/\bhelped\b/i, "Drove")
        .replace(/\bresponsible for\b/i, "Owned");
      if (!/\d/.test(next)) next += " — delivered measurable impact (add a metric).";
      return next.replace(/^\w/, (c) => c.toUpperCase());
    }
    case "passive-voice":
      return original.replace(/\b(was|were)\s+(\w+ed)\s+by\s+([^.]+)/i, "$3 $2") + " (active voice).";
    case "buzzword":
      return original.replace(
        /\b(team player|hard[- ]?working|detail[- ]?oriented|go[- ]?getter|synergy|results[- ]?driven|passionate|motivated)\b/gi,
        "[replace with a concrete example]",
      );
    case "missing-metric":
      return `${original} — add a quantified outcome (e.g. 30% improvement, 2x faster, 1M users).`;
    default:
      return `${original} (revise for clarity and impact).`;
  }
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
