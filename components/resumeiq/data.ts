import type { IconName } from "./Icon";

export type ResumeSectionKey = "summary" | "experience" | "skills" | "education";

export const industries = [
  "Technology & SaaS",
  "Finance",
  "Marketing",
  "Healthcare",
  "Design",
  "Consulting",
];

export const roles = [
  "Senior Product Designer",
  "Product Manager",
  "Frontend Engineer",
  "Data Analyst",
  "Growth Marketer",
];

export const priorities = [
  "ATS Score",
  "Grammar",
  "Impact Words",
  "Keyword Match",
  "Formatting",
  "Achievements",
  "Skills Gap",
];

export const experienceLevels = ["Fresher", "1-3 yrs", "3-7 yrs", "7+ yrs"] as const;
export const resumeTypes = ["Chronological", "Functional", "Hybrid"] as const;
export const questionGroupOrder = [
  "Behavioral",
  "Technical",
  "Role-Specific",
  "Culture Fit",
  "Resume-Based",
] as const;

export const analyzingMessages = [
  "Scanning for ATS compatibility...",
  "Evaluating impact statements...",
  "Generating interview questions...",
  "Almost there...",
];

export const defaultBarIcons: Record<string, IconName> = {
  ats: "target",
  content: "file",
  keyword: "key",
  formatting: "layout",
  impact: "light",
};

export const resumeTypeCopy: Record<(typeof resumeTypes)[number], { icon: IconName; blurb: string }> = {
  Chronological: {
    icon: "history",
    blurb: "Best for showing progression and consistent work history.",
  },
  Functional: {
    icon: "settings",
    blurb: "Focuses on skills and expertise rather than timeline.",
  },
  Hybrid: {
    icon: "layout",
    blurb: "Combines skills-based focus with detailed work history.",
  },
};
