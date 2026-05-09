import { Resume } from "../models/Resume.js";
import { Analysis } from "../models/Analysis.js";
import { Suggestion } from "../models/Suggestion.js";
import { ResumeError } from "../models/ResumeError.js";
import { InterviewQuestion } from "../models/InterviewQuestion.js";
import { KeywordMatch } from "../models/KeywordMatch.js";
import { Profile } from "../models/Profile.js";
import { BadRequest, NotFound } from "../utils/httpError.js";
import { assertOwner } from "../utils/ownership.js";
import { parsePdf, parseDocx, parseText, splitIntoSections } from "../services/parse.js";
import {
  analyzeResume,
  generateSuggestions,
  generateInterviewQuestions,
  matchKeywords,
  findErrors,
  rewriteError,
} from "../services/ai.js";
import { renderResumePdf } from "../services/pdf.js";

async function loadResume(req) {
  const r = await Resume.findById(req.params.id);
  assertOwner(r, req.user._id);
  return r;
}

function buildRawText(sections) {
  return [
    sections.summary && `SUMMARY\n${sections.summary}`,
    sections.experience && `EXPERIENCE\n${sections.experience}`,
    sections.skills && `SKILLS\n${sections.skills}`,
    sections.education && `EDUCATION\n${sections.education}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function listResumes(req, res) {
  const resumes = await Resume.find({ userId: req.user._id })
    .sort({ updatedAt: -1 })
    .select("-rawText");
  res.json({ resumes });
}

export async function createResumeFromText(req, res) {
  const name = String(req.body.name || "Pasted Resume").trim().slice(0, 200);
  const text = parseText(req.body.text);
  if (text.length < 50) throw BadRequest("RESUME_TOO_SHORT", "Please paste a longer resume (at least 50 characters).");
  const sections = splitIntoSections(text);
  const resume = await Resume.create({
    userId: req.user._id,
    name,
    source: "paste",
    rawText: text,
    sections,
  });
  res.status(201).json({ resume });
}

export async function uploadResume(req, res) {
  if (!req.file) throw BadRequest("NO_FILE", "No file uploaded");
  let text = "";
  if (req.file.mimetype === "application/pdf") {
    text = await parsePdf(req.file.buffer);
  } else {
    text = await parseDocx(req.file.buffer);
  }
  if (!text || text.length < 50) {
    throw BadRequest("PARSE_FAILED", "Couldn't extract enough text from that file. Try a different format or paste the text.");
  }
  const sections = splitIntoSections(text);
  const resume = await Resume.create({
    userId: req.user._id,
    name: req.file.originalname || "Uploaded Resume",
    source: "file",
    mimeType: req.file.mimetype,
    rawText: text,
    sections,
  });
  res.status(201).json({ resume });
}

export async function getResume(req, res) {
  const resume = await loadResume(req);
  res.json({ resume });
}

export async function patchResume(req, res) {
  const resume = await loadResume(req);
  const { summary, experience, skills, education, name } = req.body;
  if (typeof name === "string" && name.trim()) resume.name = name.trim().slice(0, 200);
  if (typeof summary === "string") resume.sections.summary = summary;
  if (typeof experience === "string") resume.sections.experience = experience;
  if (typeof skills === "string") resume.sections.skills = skills;
  if (typeof education === "string") resume.sections.education = education;
  resume.rawText = buildRawText(resume.sections);
  await resume.save();
  res.json({ resume });
}

export async function deleteResume(req, res) {
  const resume = await loadResume(req);
  const resumeId = resume._id;
  await Promise.all([
    Resume.deleteOne({ _id: resumeId }),
    Analysis.deleteMany({ resumeId }),
    Suggestion.deleteMany({ resumeId }),
    InterviewQuestion.deleteMany({ resumeId }),
    KeywordMatch.deleteMany({ resumeId }),
  ]);
  res.status(204).end();
}

export async function analyzeResumeHandler(req, res) {
  const resume = await loadResume(req);
  const profile = await Profile.findOne({ userId: req.user._id });
  const text = resume.rawText || buildRawText(resume.sections);
  const result = await analyzeResume(text, { targetRole: profile?.targetRole });
  const analysis = await Analysis.create({
    resumeId: resume._id,
    userId: req.user._id,
    overallScore: result.overallScore,
    grade: result.grade || null,
    verdict: result.verdict || null,
    bars: result.bars || [],
    issues: result.issues || [],
    wins: result.wins || [],
    dimensionScores: result.dimensionScores || null,
    positives: result.positives || [],
    top3Priorities: result.top3Priorities || [],
    interviewRedFlags: result.interviewRedFlags || [],
    atsPassProbability: result.atsPassProbability || null,
    estimatedInterviewRate: result.estimatedInterviewRate || null,
  });
  res.status(201).json({ analysis });
}

export async function getLatestAnalysis(req, res) {
  const resume = await loadResume(req);
  const analysis = await Analysis.findOne({ resumeId: resume._id }).sort({ createdAt: -1 });
  if (!analysis) throw NotFound("NO_ANALYSIS", "No analysis yet — run /analyze first.");
  res.json({ analysis });
}

export async function generateSuggestionsHandler(req, res) {
  const resume = await loadResume(req);
  let analysis = await Analysis.findOne({ resumeId: resume._id }).sort({ createdAt: -1 });
  if (!analysis) {
    const text = resume.rawText || buildRawText(resume.sections);
    const autoResult = await analyzeResume(text, {});
    analysis = await Analysis.create({
      resumeId: resume._id,
      userId: req.user._id,
      ...autoResult,
    });
  }
  const raw = await generateSuggestions(resume, analysis);
  // Replace existing un-applied suggestions.
  await Suggestion.deleteMany({ resumeId: resume._id, applied: false });
  const docs = await Suggestion.insertMany(
    raw.map((s) => ({
      analysisId: analysis._id,
      resumeId: resume._id,
      userId: req.user._id,
      section: s.section,
      old: s.old,
      next: s.next,
    })),
  );
  res.status(201).json({ suggestions: docs });
}

export async function listSuggestions(req, res) {
  const resume = await loadResume(req);
  const suggestions = await Suggestion.find({ resumeId: resume._id }).sort({ createdAt: -1 });
  res.json({ suggestions });
}

async function applyOne(resume, suggestion) {
  const current = resume.sections[suggestion.section] || "";
  const updated = current.includes(suggestion.old)
    ? current.replace(suggestion.old, suggestion.next)
    : current
      ? `${current}\n${suggestion.next}`
      : suggestion.next;
  resume.sections[suggestion.section] = updated;
  suggestion.applied = true;
  suggestion.appliedAt = new Date();
}

export async function applySuggestion(req, res) {
  const resume = await loadResume(req);
  const suggestion = await Suggestion.findById(req.params.sid);
  if (!suggestion || suggestion.resumeId.toString() !== resume._id.toString()) {
    throw NotFound("NOT_FOUND", "Suggestion not found");
  }
  if (!suggestion.applied) {
    await applyOne(resume, suggestion);
    resume.rawText = buildRawText(resume.sections);
    await resume.save();
    await suggestion.save();
  }
  res.json({ resume, suggestion });
}

export async function applyAllSuggestions(req, res) {
  const resume = await loadResume(req);
  const pending = await Suggestion.find({ resumeId: resume._id, applied: false });
  for (const s of pending) {
    await applyOne(resume, s);
    await s.save();
  }
  resume.rawText = buildRawText(resume.sections);
  await resume.save();
  res.json({ resume, applied: pending.length });
}

// ---- Errors (line-level diagnostics) -----------------------------------

export async function findErrorsHandler(req, res) {
  const resume = await loadResume(req);
  const profile = await Profile.findOne({ userId: req.user._id });
  const text = resume.rawText || buildRawText(resume.sections);
  const raw = await findErrors(text, { targetRole: profile?.targetRole });

  // Replace existing un-applied errors; keep applied ones for history.
  await ResumeError.deleteMany({ resumeId: resume._id, applied: false });
  const docs = await ResumeError.insertMany(
    raw.map((e) => ({
      resumeId: resume._id,
      userId: req.user._id,
      section: e.section,
      line: e.line,
      severity: e.severity,
      category: e.category,
      reason: e.reason,
    })),
  );
  res.status(201).json({ errors: docs });
}

export async function listErrors(req, res) {
  const resume = await loadResume(req);
  const errors = await ResumeError.find({ resumeId: resume._id }).sort({ createdAt: -1 });
  res.json({ errors });
}

export async function rewriteErrorHandler(req, res) {
  const resume = await loadResume(req);
  const error = await ResumeError.findById(req.params.eid);
  if (!error || error.resumeId.toString() !== resume._id.toString()) {
    throw NotFound("NOT_FOUND", "Error not found");
  }
  if (error.applied) {
    return res.json({ error });
  }
  const { fix } = await rewriteError(error.toObject(), resume);
  error.fix = String(fix || "").trim();
  await error.save();
  res.json({ error });
}

async function applyOneError(resume, error) {
  const fix = error.fix;
  if (!fix) return false;
  const current = resume.sections[error.section] || "";
  const updated = current.includes(error.line)
    ? current.replace(error.line, fix)
    : current
      ? `${current}\n${fix}`
      : fix;
  resume.sections[error.section] = updated;
  error.applied = true;
  error.appliedAt = new Date();
  return true;
}

export async function applyErrorHandler(req, res) {
  const resume = await loadResume(req);
  const error = await ResumeError.findById(req.params.eid);
  if (!error || error.resumeId.toString() !== resume._id.toString()) {
    throw NotFound("NOT_FOUND", "Error not found");
  }
  if (!error.fix) {
    throw BadRequest("NO_FIX", "Generate a fix before applying. Click \"Get AI fix\" first.");
  }
  if (!error.applied) {
    await applyOneError(resume, error);
    resume.rawText = buildRawText(resume.sections);
    await resume.save();
    await error.save();
  }
  res.json({ resume, error });
}

export async function generateInterviewHandler(req, res) {
  const resume = await loadResume(req);
  const profile = await Profile.findOne({ userId: req.user._id });
  const count = Math.max(1, Math.min(Number(req.body.count) || 2, 4));
  const text = resume.rawText || buildRawText(resume.sections);
  const raw = await generateInterviewQuestions(text, {
    targetRole: profile?.targetRole,
    count,
  });
  // Keep history but only return the newly generated set.
  const docs = await InterviewQuestion.insertMany(
    raw.map((q) => ({
      resumeId: resume._id,
      userId: req.user._id,
      group: q.group,
      text: q.text,
      difficulty: q.difficulty || "Medium",
    })),
  );
  res.status(201).json({ questions: docs });
}

export async function listInterviewQuestions(req, res) {
  const resume = await loadResume(req);
  const questions = await InterviewQuestion.find({ resumeId: resume._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json({ questions });
}

export async function matchKeywordsHandler(req, res) {
  const resume = await loadResume(req);
  const jd = String(req.body.jobDescription || "").trim();
  if (jd.length < 30) throw BadRequest("JD_TOO_SHORT", "Job description is too short.");
  const text = resume.rawText || buildRawText(resume.sections);
  const raw = await matchKeywords(text, jd);
  const match = await KeywordMatch.create({
    resumeId: resume._id,
    userId: req.user._id,
    jobDescription: jd.slice(0, 20000),
    found: raw.found,
    missing: raw.missing,
  });
  res.status(201).json({ match });
}

export async function exportResumePdf(req, res) {
  const resume = await loadResume(req);
  const profile = await Profile.findOne({ userId: req.user._id });
  const opts = {
    template: req.query.template,
    font: req.query.font,
    accent: req.query.accent,
    includeAiSummary: req.query.includeAiSummary !== "false",
  };
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${(resume.name || "resume").replace(/[^a-z0-9._-]/gi, "_")}.pdf"`,
  );
  const doc = renderResumePdf({ profile, resume }, opts);
  doc.pipe(res);
}
