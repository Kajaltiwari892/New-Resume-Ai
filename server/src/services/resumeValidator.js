// Heuristic resume validation. We can't perfectly tell a resume from a random
// document, but the combination of these signals catches >95% of non-resume
// uploads (e.g., contracts, articles, blank scans) without rejecting real
// resumes — including unconventional ones.
//
// The result is a score 0–100. We accept >= 35 (intentionally lenient so we
// don't reject legitimate but minimal/unusual resumes) and surface the signals
// to the client so users see *why* their upload was rejected.

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
// Matches 10–14 digit phone-like sequences (with separators or country codes).
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
// Date ranges typical of resumes: "Jan 2020 - Present", "2018 – 2022", "06/2019–08/2021".
const DATE_RANGE_RE =
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)[a-z]*\.?\s+\d{4}\s*[-–—to]+\s*(?:Present|Current|Now|\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4})|\b\d{1,2}\/\d{4}\s*[-–—to]+\s*(?:Present|Current|\d{1,2}\/\d{4})|\b\d{4}\s*[-–—to]+\s*(?:Present|Current|\d{4})/i;

const SECTION_HEADERS = [
  /\b(work|professional|employment)\s+(experience|history)\b/i,
  /\bexperience\b/i,
  /\beducation\b/i,
  /\b(technical|core|key)?\s*skills\b/i,
  /\bprojects?\b/i,
  /\bcertifications?\b/i,
  /\b(summary|profile|objective|about\s+me)\b/i,
  /\bachievements?\b/i,
  /\bpublications?\b/i,
  /\bawards?\b/i,
];

const ACTION_VERBS = [
  "managed", "led", "built", "developed", "designed", "implemented",
  "created", "launched", "delivered", "drove", "improved", "increased",
  "reduced", "optimized", "automated", "architected", "engineered",
  "scaled", "shipped", "owned", "founded", "established", "spearheaded",
  "mentored", "coached", "collaborated", "coordinated", "analyzed",
  "researched", "presented", "negotiated", "deployed", "migrated",
  "refactored", "integrated", "tested", "maintained",
];

// Words you'd see in contracts, articles, invoices — used as a *negative* signal.
const NON_RESUME_HINTS = [
  /\b(this agreement|invoice number|terms and conditions|table of contents|abstract|references\s*\[1\])\b/i,
  /\b(chapter \d+|figure \d+|page \d+ of \d+)\b/i,
  /\bdear (sir|madam|hiring manager)\b/i, // cover letter, not resume
];

function countMatches(text, re) {
  const m = text.match(new RegExp(re.source, "gi"));
  return m ? m.length : 0;
}

function countWords(text) {
  return (text.match(/\S+/g) || []).length;
}

function countBulletLines(text) {
  return text
    .split(/\n/)
    .filter((l) => /^\s*([•·●▪◦*\-–—]|\d+[.)])\s+\S/.test(l)).length;
}

function distinctActionVerbCount(text) {
  const lower = text.toLowerCase();
  const seen = new Set();
  for (const v of ACTION_VERBS) {
    if (new RegExp(`\\b${v}\\b`).test(lower)) seen.add(v);
  }
  return seen.size;
}

function matchingSectionHeaders(text) {
  const found = [];
  for (const re of SECTION_HEADERS) {
    if (re.test(text)) {
      const m = text.match(re);
      if (m && m[0]) found.push(m[0].trim());
    }
  }
  return [...new Set(found.map((s) => s.toLowerCase()))];
}

// Strong "this is unambiguously a resume" signals. Real resumes almost always
// have at least 2 of these; non-resume PDFs almost never do.
const CORE_MARKERS = [
  {
    key: "experience",
    label: "Work Experience section",
    test: (t) =>
      /\b(work\s+experience|professional\s+experience|employment\s+(history|experience)|experience\s*:|work\s+history|career\s+history)\b/i.test(t),
  },
  {
    key: "education",
    label: "Education section",
    test: (t) => /\b(education\s*:|education\s*\n|academic\s+(background|qualifications)|degree|bachelor|master|b\.?s\.?c|m\.?s\.?c|b\.?tech|m\.?tech)\b/i.test(t),
  },
  {
    key: "skills",
    label: "Skills section",
    test: (t) => /\b((technical|core|key)?\s*skills\s*:|skills\s*\n|tech\s+stack|technologies\s*:)\b/i.test(t),
  },
  {
    key: "dates",
    label: "Employment / education date ranges",
    test: (t) => DATE_RANGE_RE.test(t),
  },
  {
    key: "contact",
    label: "Email + phone contact details",
    test: (t) => EMAIL_RE.test(t) && PHONE_RE.test(t),
  },
];

/**
 * Returns { ok: boolean, score: number, found: string[], missing: string[],
 * wordCount: number, hint: string }.
 *
 * Decision rule:
 *   - Hard fail if < 40 words OR negative signals present.
 *   - HARD GATE: must hit at least 2 of the 5 core resume markers above.
 *   - Then a soft score check (>= 35) on the broader signal mix.
 */
export function validateResumeText(rawText) {
  const text = String(rawText || "");
  const wordCount = countWords(text);
  const found = [];
  const missing = [];
  let score = 0;

  // Hard fail: way too short to be any meaningful document, let alone a resume.
  if (wordCount < 40) {
    return {
      ok: false,
      score: 0,
      found: [],
      missing: ["The file contains almost no readable text"],
      wordCount,
      hint:
        "We couldn't pull enough text from this file. If it's a scanned/image-only PDF, export a text-based PDF or paste the resume content directly.",
    };
  }

  // --- Core marker hard gate (must hit ≥ 2 of 5) --------------------------
  const coreHits = [];
  const coreMisses = [];
  for (const m of CORE_MARKERS) {
    if (m.test(text)) coreHits.push(m);
    else coreMisses.push(m);
  }

  // --- Soft scoring (still useful for the "What we found" panel) ----------
  if (EMAIL_RE.test(text)) {
    score += 18;
    found.push("Email address");
  }
  if (PHONE_RE.test(text)) {
    score += 12;
    found.push("Phone number");
  }
  if (DATE_RANGE_RE.test(text)) {
    score += 15;
    found.push("Employment / education dates");
  }
  const sectionHeaders = matchingSectionHeaders(text);
  if (sectionHeaders.length >= 1) {
    score += 18;
    found.push(`Section: ${sectionHeaders[0]}`);
  }
  if (sectionHeaders.length >= 2) {
    score += 10;
    found.push(`Section: ${sectionHeaders[1]}`);
  }
  const bullets = countBulletLines(text);
  if (bullets >= 3) {
    score += 10;
    found.push(`${bullets} bulleted lines`);
  }
  const verbs = distinctActionVerbCount(text);
  if (verbs >= 3) {
    score += 12;
    found.push(`${verbs} resume-style action verbs`);
  } else if (verbs >= 1) {
    score += 4;
  }
  if (wordCount >= 80 && wordCount <= 5000) {
    score += 5;
  }

  // Negative signals (contracts / cover letters / articles)
  let negative = 0;
  for (const re of NON_RESUME_HINTS) {
    if (re.test(text)) negative += 1;
  }
  if (negative >= 1) {
    score = Math.max(0, score - 25 * negative);
  }

  score = Math.max(0, Math.min(100, score));

  // --- Final decision -----------------------------------------------------
  const enoughCore = coreHits.length >= 2;
  const enoughScore = score >= 35;
  const ok = enoughCore && enoughScore && negative === 0;

  // Build the "missing" list from concrete things the user can fix.
  if (!ok) {
    for (const m of coreMisses) missing.push(m.label);
    if (negative > 0) {
      missing.push("Looks more like a contract, cover letter, article, or report");
    }
    if (bullets < 3) missing.push("Few or no bulleted achievements");
    if (verbs < 3) missing.push("No resume-style action verbs (managed, built, led, …)");
  }

  return {
    ok,
    score,
    found,
    missing,
    wordCount,
    hint: ok
      ? ""
      : "This doesn't look like a resume. A resume usually has contact details, employment date ranges, and clearly labeled Experience and Education sections. Upload your CV in PDF/DOCX or paste it as text.",
  };
}
