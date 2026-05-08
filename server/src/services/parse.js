import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function parsePdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeText(result.text || "");
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeText(result.value || "");
}

export function parseText(raw) {
  return normalizeText(String(raw || ""));
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Heuristic split into resume sections. Falls back to putting everything
// in `experience` when no headers are recognized.
const HEADER_MAP = [
  { key: "summary", patterns: [/^(professional\s+)?summary$/i, /^profile$/i, /^objective$/i, /^about( me)?$/i] },
  { key: "experience", patterns: [/^(work\s+)?experience$/i, /^employment( history)?$/i, /^professional experience$/i, /^career history$/i] },
  { key: "skills", patterns: [/^skills$/i, /^(technical|core) skills$/i, /^competencies$/i, /^tech(nical)? stack$/i] },
  { key: "education", patterns: [/^education$/i, /^academic(\s+background)?$/i, /^qualifications$/i] },
];

function identifyHeader(line) {
  const trimmed = line.trim().replace(/[:–—]+$/, "").trim();
  if (!trimmed || trimmed.length > 40) return null;
  if (!/^[A-Za-z][A-Za-z &/]*$/.test(trimmed)) return null;
  for (const { key, patterns } of HEADER_MAP) {
    if (patterns.some((p) => p.test(trimmed))) return key;
  }
  return null;
}

export function splitIntoSections(text) {
  const sections = { summary: "", experience: "", skills: "", education: "" };
  const lines = text.split("\n");
  let current = null;
  const buffers = { summary: [], experience: [], skills: [], education: [] };

  for (const line of lines) {
    const header = identifyHeader(line);
    if (header) {
      current = header;
      continue;
    }
    if (current) buffers[current].push(line);
  }

  for (const k of Object.keys(buffers)) {
    sections[k] = buffers[k].join("\n").trim();
  }

  // Fallback: if nothing was split, dump everything into experience.
  const empty = Object.values(sections).every((s) => !s);
  if (empty) sections.experience = text;

  return sections;
}
