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

function wordCount(text) {
  return (text || "").split(/\s+/).filter(Boolean).length;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pct(score, max) {
  if (!max) return 0;
  return clamp(Math.round((score / max) * 100), 0, 100);
}

function gradeFromScore(score) {
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 42) return "D";
  return "F";
}

function interviewRateFromScore(score) {
  if (score >= 85) return "12-18%";
  if (score >= 72) return "7-11%";
  if (score >= 58) return "3-6%";
  if (score >= 42) return "1-3%";
  return "<1%";
}

function atsProbabilityFromScore(score) {
  if (score >= 78) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function hasMetric(text) {
  return /(\d+(\.\d+)?\s?%|\d+(\.\d+)?\s?x|\$\s?\d|\b\d+(\.\d+)?\s?(k|m|b|million|billion|lakh|crore)\b|\b\d{2,}\b|\b\d+\s?(users|customers|clients|requests|tickets|projects|members|engineers|hours|days|weeks|months)\b)/i.test(text);
}

function hasMetrics(text) {
  return hasMetric(text);
}

const STRONG_VERBS = [
  "accelerated", "achieved", "architected", "automated", "built", "delivered",
  "created", "collaborated", "designed", "developed", "deployed", "drove",
  "engineered", "implemented", "improved", "increased", "integrated",
  "launched", "led", "migrated", "optimized", "owned", "reduced",
  "refactored", "scaled", "shipped", "spearheaded", "streamlined",
];

const WEAK_VERB_RE =
  /^(worked|helped|assisted|responsible|participated|involved|contributed|handled|supported|used|utilized|learned|tried|made|did)\b/i;
const PASSIVE_RE = /\b(was|were|is|are|been|being)\s+\w+ed\b/i;
const CLICHE_RE =
  /\b(passionate|hard[- ]?working|motivated|team player|detail[- ]?oriented|results[- ]?driven|self[- ]?starter|seeking|looking to leverage|go[- ]?getter|rockstar|ninja)\b/i;
const RESPONSIBILITY_RE = /\b(responsible for|duties included|tasked with|worked on|helped with|participated in|involved in)\b/i;
const CONTACT_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN_RE = /\blinked\s?in\b|linkedin\.com|linkedin:/i;
const GITHUB_RE = /\bgithub\b|github\.com|github:/i;
const PORTFOLIO_RE = /\b(portfolio|behance|dribbble|figma|adobe portfolio|artstation|uxfolio|case study|case studies)\b/i;

const ROLE_RUBRICS = {
  tech: {
    match: /\b(frontend|backend|full[- ]?stack|developer|engineer|software|react|node|java|python|javascript|typescript|devops)\b/i,
    label: "Software / Engineering",
    proofLabel: "GitHub or deployed portfolio",
    proofRe: /\b(github|deployed|live|portfolio|vercel|netlify|render|app store|play store)\b/i,
    keywords: ["react", "node", "typescript", "api", "database", "testing", "deployment", "security"],
    strongSignals: ["deployed systems", "performance metrics", "secure APIs", "tests", "production scale"],
    weakSignals: ["no GitHub/deployed proof", "tool list without project evidence", "no performance or reliability metric"],
  },
  design: {
    match: /\b(graphic|visual|brand|ui\/ux|ux|product designer|designer|illustrator|photoshop|figma)\b/i,
    label: "Design / Creative",
    proofLabel: "portfolio, Behance, Dribbble, or case-study link",
    proofRe: PORTFOLIO_RE,
    keywords: ["figma", "photoshop", "illustrator", "indesign", "branding", "typography", "layout", "campaign", "portfolio"],
    strongSignals: ["portfolio proof", "case studies", "brand systems", "campaign outcomes", "tool fluency"],
    weakSignals: ["no portfolio", "only tools listed", "no client/campaign impact", "no visual case-study context"],
  },
  data: {
    match: /\b(data analyst|business analyst|analytics|power bi|tableau|sql|excel|python|dashboard|statistics)\b/i,
    label: "Data / Analytics",
    proofLabel: "dashboard, SQL, BI, or analytics project proof",
    proofRe: /\b(sql|dashboard|power bi|tableau|excel|python|pandas|analytics|a\/b|kpi|forecast|visualization)\b/i,
    keywords: ["sql", "excel", "python", "dashboard", "power bi", "tableau", "kpi", "analysis"],
    strongSignals: ["SQL proof", "dashboard/project proof", "business KPI movement", "stakeholder insights", "data cleaning"],
    weakSignals: ["no dashboard", "no SQL/BI proof", "no business decision impact", "only coursework tools"],
  },
};

function getRoleRubric(text, targetRole = "") {
  const haystack = `${targetRole}\n${text}`;
  if (ROLE_RUBRICS.design.match.test(haystack)) return { key: "design", ...ROLE_RUBRICS.design };
  if (ROLE_RUBRICS.data.match.test(haystack)) return { key: "data", ...ROLE_RUBRICS.data };
  if (ROLE_RUBRICS.tech.match.test(haystack)) return { key: "tech", ...ROLE_RUBRICS.tech };
  return { key: "general", label: "General", proofLabel: "portfolio or work sample link", proofRe: PORTFOLIO_RE, keywords: [] };
}

const UNIVERSAL_RUBRIC = [
  "Clear target role and recruiter-readable summary",
  "Core ATS sections: Experience, Skills, Education, Projects/Portfolio when relevant",
  "Achievement bullets with action, scope, method, and measurable result",
  "Role keywords backed by work/project evidence, not only a skills list",
  "Proof links recruiters can open: LinkedIn plus GitHub, portfolio, dashboards, or case studies as role-appropriate",
  "Concise formatting, consistent dates, no first-person filler, no references section",
];

export function retrieveResumeRubric(text, opts = {}) {
  const role = getRoleRubric(text, opts.targetRole);
  return {
    role,
    universal: UNIVERSAL_RUBRIC,
    checks: [
      ...UNIVERSAL_RUBRIC,
      `Role family: ${role.label || "General"}`,
      `Required proof: ${role.proofLabel}`,
      `Important role keywords: ${(role.keywords || []).join(", ") || "target-role keywords from the job description"}`,
      `Strong signals: ${(role.strongSignals || []).join(", ") || "measurable outcomes and proof of work"}`,
      `Weak signals: ${(role.weakSignals || []).join(", ") || "generic claims without evidence"}`,
    ],
  };
}

function hasSection(text, section) {
  const re = new RegExp(`(^|\\n)\\s*${section.replace(/\s+/g, "\\s+")}\\s*:?\\s*(\\n|$)`, "i");
  return re.test(text);
}

function hasAnySection(text, sections) {
  return sections.some((section) => hasSection(text, section));
}

function extractBullets(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const bulletLines = [];
  for (const line of lines) {
    const bullet = line.match(/^(?:[-*]|\d+[.)]|\u2022|\u00b7|\u25cf|\u25aa)\s*(.+)$/);
    if (bullet?.[1]) bulletLines.push(bullet[1].trim());
  }
  if (bulletLines.length) return bulletLines;

  return lines.filter((line) => {
    if (line.length < 25 || line.length > 240) return false;
    if (/^(summary|objective|profile|experience|education|skills|projects|certifications)$/i.test(line)) return false;
    return /[a-z]/i.test(line);
  });
}

function firstWord(line) {
  return (line.match(/[A-Za-z]+/)?.[0] || "").toLowerCase();
}

function issue({ severity = "Moderate", category, title, description, original = "", location = "" }) {
  return {
    severity,
    category,
    title,
    description,
    original_text: original,
    location,
    fix_instruction: description,
    example_fix: "",
  };
}

function analyzeResumeHeuristicLegacy(text, { targetRole } = {}) {
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

export function analyzeResumeHeuristic(text, { targetRole } = {}) {
  const wc = wordCount(text);
  const raw = String(text || "");
  const roleRubric = getRoleRubric(raw, targetRole);
  const bullets = extractBullets(raw);
  const bulletCount = bullets.length;
  const metricBullets = bullets.filter(hasMetric).length;
  const metricCount = (raw.match(/\d+/g) || []).length;
  const weakBullets = bullets.filter((line) => WEAK_VERB_RE.test(line) || RESPONSIBILITY_RE.test(line));
  const passiveBullets = bullets.filter((line) => PASSIVE_RE.test(line));
  const strongStarts = bullets.filter((line) => STRONG_VERBS.includes(firstWord(line)));
  const tooShort = bullets.filter((line) => wordCount(line) < 8);
  const tooLong = bullets.filter((line) => wordCount(line) > 35);
  const repeatedStarts = new Map();

  for (const line of bullets) {
    const w = firstWord(line);
    if (w) repeatedStarts.set(w, (repeatedStarts.get(w) || 0) + 1);
  }

  const repeatedVerbPenalty = [...repeatedStarts.values()].filter((n) => n > 2).length;
  const sectionCount = ATS_FRIENDLY_SECTIONS.filter((s) => hasSection(raw, s)).length;
  const hasExperience = hasAnySection(raw, ["experience", "work experience", "professional experience", "employment history"]);
  const hasEducation = hasSection(raw, "education");
  const hasSkills = hasAnySection(raw, ["skills", "technical skills", "core skills"]);
  const hasSummary = hasAnySection(raw, ["summary", "profile", "objective"]);
  const hasProjects = hasAnySection(raw, ["projects", "project"]);
  const hasEmail = CONTACT_RE.test(raw);
  const hasPhone = PHONE_RE.test(raw);
  const hasLinkedIn = LINKEDIN_RE.test(raw);
  const hasGithub = GITHUB_RE.test(raw);
  const hasPortfolio = PORTFOLIO_RE.test(raw);
  const hasRoleProof = roleRubric.proofRe.test(raw) || (roleRubric.key === "tech" && hasGithub);
  const hasDates = /\b(19|20)\d{2}\b/.test(raw);
  const hasLocation = /\b(remote|hybrid|onsite|india|usa|united states|canada|uk|london|new york|delhi|mumbai|bangalore|bengaluru|pune|hyderabad)\b/i.test(raw);
  const hasFirstPerson = /\b(i|me|my|mine|we|our)\b/i.test(raw);
  const hasReferences = /\breferences available\b|\breferences\b/i.test(raw);
  const hasCliche = CLICHE_RE.test(raw);
  const targetWords = targetRole ? String(targetRole).toLowerCase().split(/\s+/).filter((w) => w.length > 2) : [];
  const targetHits = targetWords.length ? countOccurrences(raw, targetWords) : 0;
  const roleKeywordHits = countOccurrences(raw, roleRubric.keywords || []);
  const leadership = countOccurrences(raw, LEADERSHIP_KEYWORDS);
  const scopeSignals = countOccurrences(raw, [
    "cross-functional", "stakeholder", "owned", "ownership", "mentor", "mentored",
    "reviewed", "roadmap", "strategy", "team", "led", "collaborated", "end-to-end",
    "architecture", "production", "scale", "users", "revenue",
  ]);

  const metricRatio = bulletCount ? metricBullets / bulletCount : 0;
  const strongRatio = bulletCount ? strongStarts.length / bulletCount : 0;
  const weakRatio = bulletCount ? weakBullets.length / bulletCount : 0;

  const impactScore = clamp(Math.round(metricRatio * 18) + Math.min(7, metricCount), 0, 25);
  const actionVerbScore = clamp(
    Math.round(strongRatio * 10) + Math.min(5, new Set(strongStarts.map(firstWord)).size) -
      weakBullets.length * 2 -
      passiveBullets.length -
      repeatedVerbPenalty * 2,
    0,
    15,
  );
  const bulletQualityScore = clamp(
    15 -
      tooShort.length * 2 -
      tooLong.length * 2 -
      weakBullets.length -
      passiveBullets.length -
      (bulletCount < 4 ? 4 : 0) -
      (metricRatio < 0.35 ? 3 : 0),
    0,
    15,
  );
  const atsScore = clamp(
    sectionCount * 2 +
      (hasEmail ? 1 : 0) +
      (hasPhone ? 1 : 0) +
      (hasLinkedIn ? 2 : 0) +
      (hasGithub || hasPortfolio || hasRoleProof ? 1 : 0) +
      (hasDates ? 2 : 0) +
      (hasLocation ? 1 : 0) +
      (targetHits ? 2 : 0) +
      (roleKeywordHits >= 3 ? 1 : 0),
    0,
    15,
  );
  const leadershipScore = clamp(Math.min(10, scopeSignals + Math.floor(leadership / 2)), 0, 10);
  const formattingScore = clamp(
    10 -
      (wc < 120 ? 3 : wc < 180 ? 1 : 0) -
      (wc > 1000 ? 2 : 0) -
      (sectionCount < 3 ? 3 : 0) -
      (!hasDates ? 2 : 0) -
      (hasFirstPerson ? 2 : 0) -
      (hasReferences ? 2 : 0),
    0,
    10,
  );
  const summaryScore = clamp(
    (hasSummary ? 3 : 0) +
      (!hasCliche && hasSummary ? 1 : 0) +
      (hasSummary && hasMetric(raw.slice(0, 700)) ? 1 : 0) -
      (hasFirstPerson ? 1 : 0),
    0,
    5,
  );
  const projectsScore = clamp(
    (hasProjects ? 2 : 0) +
      (hasGithub || hasPortfolio || hasRoleProof ? 1 : 0) +
      (hasProjects && hasMetric(raw) ? 1 : 0) +
      (hasProjects && /\b(api|database|cloud|production|deployed|users|performance|latency|scale|dashboard|brand|campaign|case study|visualization)\b/i.test(raw) ? 1 : 0),
    0,
    5,
  );

  const dimensionScores = {
    impact_quantification: { score: impactScore, max: 25 },
    action_verbs: { score: actionVerbScore, max: 15 },
    bullet_quality: { score: bulletQualityScore, max: 15 },
    ats_keywords: { score: atsScore, max: 15 },
    leadership_scope: { score: leadershipScore, max: 10 },
    formatting: { score: formattingScore, max: 10 },
    summary: { score: summaryScore, max: 5 },
    projects: { score: projectsScore, max: 5 },
  };

  let overallScore =
    impactScore +
    actionVerbScore +
    bulletQualityScore +
    atsScore +
    leadershipScore +
    formattingScore +
    summaryScore +
    projectsScore;

  const caps = [];
  if (bulletCount < 3) caps.push(55);
  if (!hasExperience) caps.push(65);
  if (!hasEducation || !hasSkills) caps.push(78);
  if (!hasEmail && !hasPhone) caps.push(70);
  if (metricRatio === 0) caps.push(65);
  else if (metricRatio < 0.25) caps.push(76);
  else if (metricRatio < 0.5) caps.push(88);
  if (weakRatio >= 0.35) caps.push(76);
  if (sectionCount < 3) caps.push(75);
  if (wc < 120) caps.push(62);
  else if (wc < 180) caps.push(76);
  if (wc > 1200) caps.push(76);
  if (hasCliche) caps.push(82);
  if (hasFirstPerson) caps.push(80);
  if (hasReferences) caps.push(78);
  overallScore = clamp(Math.min(overallScore, ...caps, 100), 0, 100);

  const hasCoreResumeShape = hasExperience && hasEducation && hasSkills;
  const hasSomeProof = hasLinkedIn || hasRoleProof || hasProjects;
  const calibrationLift =
    (hasCoreResumeShape ? 4 : 0) +
    (hasSomeProof ? 3 : 0) +
    (metricRatio >= 0.25 ? 5 : metricRatio > 0 ? 2 : 0) +
    (strongRatio >= 0.35 ? 4 : 0) +
    (roleKeywordHits >= 3 ? 3 : 0);
  overallScore = clamp(Math.min(overallScore + calibrationLift, ...caps, 100), 0, 100);

  const bars = [
    { key: "impact", label: "Impact & Metrics", value: pct(impactScore, 25) },
    { key: "verb", label: "Action Verbs", value: pct(actionVerbScore, 15) },
    { key: "bullet", label: "Bullet Quality", value: pct(bulletQualityScore, 15) },
    { key: "ats", label: "ATS Keywords", value: pct(atsScore, 15) },
    { key: "leadership", label: "Leadership", value: pct(leadershipScore, 10) },
    { key: "formatting", label: "Formatting", value: pct(formattingScore, 10) },
    { key: "summary", label: "Summary", value: pct(summaryScore, 5) },
    { key: "projects", label: "Projects", value: pct(projectsScore, 5) },
  ];

  const issues = [];
  if (metricRatio === 0) {
    issues.push(issue({
      severity: "Critical",
      category: "impact",
      title: "No quantified achievement bullets",
      description: "Recruiter-grade resumes need numbers in the experience bullets: percentage, revenue, time saved, scale, users, or volume.",
    }));
  } else if (metricRatio < 0.5) {
    issues.push(issue({
      severity: "Critical",
      category: "impact",
      title: "Too few bullets prove measurable impact",
      description: `Only ${metricBullets}/${bulletCount} achievement lines include metrics. Aim for at least half.`,
    }));
  }
  if (weakBullets.length) {
    issues.push(issue({
      severity: "Moderate",
      category: "verb",
      title: "Weak responsibility-led bullets",
      description: "Replace phrases like worked on, helped, responsible for, and used with ownership verbs plus the outcome.",
      original: weakBullets[0],
      location: "Experience",
    }));
  }
  if (strongRatio < 0.5) {
    issues.push(issue({
      severity: "Moderate",
      category: "verb",
      title: "Not enough bullets start with strong action verbs",
      description: "Most bullets should begin with verbs like Built, Led, Shipped, Reduced, Automated, Optimized, or Launched.",
    }));
  }
  if (tooLong.length) {
    issues.push(issue({
      severity: "Moderate",
      category: "structure",
      title: "Bullets are too long for fast recruiter scanning",
      description: "Keep bullets under 30-35 words and lead with the result.",
      original: tooLong[0],
      location: "Experience",
    }));
  }
  if (!hasLinkedIn) {
    issues.push(issue({
      severity: "Minor",
      category: "ats",
      title: "Missing LinkedIn profile",
      description: "Add a clean LinkedIn URL in the header so recruiters can verify your profile quickly.",
    }));
  }
  if (!hasRoleProof && roleRubric.key !== "general") {
    issues.push(issue({
      severity: "Minor",
      category: "ats",
      title: `Missing ${roleRubric.proofLabel}`,
      description:
        roleRubric.key === "design"
          ? "Design resumes need visible proof: portfolio, Behance, Dribbble, Figma case studies, or campaign samples."
          : roleRubric.key === "data"
            ? "Data resumes need visible proof: dashboards, SQL/BI projects, analytics case studies, or quantified business insights."
            : "Technical resumes are stronger when projects link to GitHub, portfolio, or deployed work.",
    }));
  }
  if (leadershipScore < 4) {
    issues.push(issue({
      severity: "Moderate",
      category: "leadership",
      title: "Missing scope and ownership signals",
      description: "Add team size, stakeholders, ownership, production impact, architecture, roadmap, or mentoring context where true.",
    }));
  }
  if (hasCliche) {
    issues.push(issue({
      severity: "Moderate",
      category: "summary",
      title: "Generic summary language",
      description: "Remove cliches like passionate, hardworking, motivated, or team player. Replace them with role, scope, and proof.",
    }));
  }
  if (wc < 120) {
    issues.push(issue({
      severity: "Critical",
      category: "formatting",
      title: "Resume is too thin to score strongly",
      description: "Add more achievement bullets, technologies used in context, projects, scope, and quantified outcomes.",
    }));
  }
  if (!hasExperience || !hasEducation || !hasSkills) {
    issues.push(issue({
      severity: "Critical",
      category: "ats",
      title: "Missing core ATS sections",
      description: "A strong ATS resume should clearly label Experience, Skills, and Education sections.",
    }));
  }

  const wins = [];
  if (metricRatio >= 0.5) wins.push("Several bullets include quantified outcomes");
  if (strongRatio >= 0.6) wins.push("Strong action verbs are visible");
  if (sectionCount >= 4) wins.push("Core ATS sections are present");
  if (leadershipScore >= 7) wins.push("Good ownership and scope signals");
  if (wins.length === 0) wins.push("Readable foundation, but it needs stronger proof and stricter resume positioning");

  const positives = wins.map((title) => ({ title, description: "" }));
  const top3Priorities = issues.slice(0, 3).map((item) => item.title);
  const interviewRedFlags = issues
    .filter((item) => item.severity === "Critical")
    .slice(0, 4)
    .map((item) => item.title);

  return {
    overallScore,
    grade: gradeFromScore(overallScore),
    verdict:
      overallScore >= 85
        ? "Strong resume, but keep pressure-testing every bullet for measurable business impact."
        : overallScore >= 70
          ? "Good base, but not yet elite. The resume needs more proof, sharper bullets, and stronger ATS signals."
          : overallScore >= 55
            ? "Average resume. It may pass basic screening, but recruiters will likely skip it unless impact and keywords improve."
            : "Weak resume by recruiter standards. Fix metrics, bullet quality, core sections, and role-specific proof before applying.",
    bars,
    issues: issues.slice(0, 14),
    wins,
    dimensionScores,
    positives,
    top3Priorities,
    interviewRedFlags,
    atsPassProbability: atsProbabilityFromScore(overallScore),
    estimatedInterviewRate: interviewRateFromScore(overallScore),
  };
}

export function applyStrictScoringGuardrails(result, text, opts = {}) {
  const strict = analyzeResumeHeuristic(text, opts);
  const incomingScore = Number.isFinite(result?.overallScore) ? result.overallScore : 100;
  const overallScore = Math.min(incomingScore, strict.overallScore);
  const mergedIssues = [...strict.issues, ...(result?.issues || [])].slice(0, 18);
  const top3Priorities = [
    ...strict.top3Priorities,
    ...((result?.top3Priorities || []).filter((item) => !strict.top3Priorities.includes(item))),
  ].slice(0, 3);

  return {
    ...result,
    overallScore,
    grade: gradeFromScore(overallScore),
    verdict: strict.verdict,
    bars: strict.bars,
    issues: mergedIssues,
    wins: strict.wins,
    dimensionScores: strict.dimensionScores,
    positives: strict.positives,
    top3Priorities,
    interviewRedFlags: strict.interviewRedFlags,
    atsPassProbability: atsProbabilityFromScore(overallScore),
    estimatedInterviewRate: interviewRateFromScore(overallScore),
  };
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
  const resumeText = [summary, exp, skills, education].filter(Boolean).join("\n\n");
  const roleRubric = getRoleRubric(resumeText);

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
    if (out.length >= 16) break;

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

  if (!roleRubric.proofRe.test(resumeText)) {
    push({
      section: "summary",
      old: summary || "",
      next: `Add visible role proof near the header or projects section: ${roleRubric.proofLabel}. Recruiters expect this for ${roleRubric.label || "this role"} resumes.`,
      reason: `Missing role-specific proof: ${roleRubric.proofLabel}.`,
    });
  }

  const roleKeywordMissing = (roleRubric.keywords || [])
    .filter((keyword) => !new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i").test(resumeText))
    .slice(0, 5);
  if (roleKeywordMissing.length) {
    push({
      section: "skills",
      old: skills || "",
      next: `Add only truthful role-relevant keywords and prove them in project bullets: ${roleKeywordMissing.join(", ")}.`,
      reason: `Missing ${roleRubric.label || "role"} keywords that recruiters often scan for.`,
    });
  }

  for (const line of expLines) {
    if (out.length >= 20) break;
    if (line.length > 45 && !/\b(because|result|reduced|increased|improved|saving|saved|lowering|raising|grew|growth|conversion|latency|revenue|users)\b/i.test(line)) {
      push({
        section: "experience",
        old: line,
        next: `${line.replace(/[.\s]+$/, "")} — add the business/user outcome this work created.`,
        reason: "The bullet describes work but not the result a recruiter can value.",
      });
    }
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

  return out.slice(0, 20);
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
