"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Clock, FileText, Sparkles, Target, TrendingUp, AlertTriangle } from "lucide-react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { getAnalysis, listResumes, type Analysis, type Resume } from "@/lib/resumeClient";

type Row = { resume: Resume; analysis: Analysis | null };

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE, delay: i * 0.06 },
  }),
};

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  B: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  C: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  D: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  F: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const ATS_COLOR: Record<string, string> = {
  high: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

function relativeTime(iso?: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-rose-300";
}

export default function HistoryPage() {
  const { user, checked } = useRequireAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { resumes } = await listResumes();
        const settled = await Promise.all(
          resumes.map(async (resume) => {
            try {
              const { analysis } = await getAnalysis(resume.id);
              return { resume, analysis } as Row;
            } catch {
              return { resume, analysis: null } as Row;
            }
          }),
        );
        setRows(settled);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const da = new Date(a.analysis?.createdAt || a.resume.createdAt).getTime();
        const db = new Date(b.analysis?.createdAt || b.resume.createdAt).getTime();
        return db - da;
      }),
    [rows],
  );

  const analyzedCount = rows.filter((r) => r.analysis).length;

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Past resume scans" title="History">
      <motion.div
        className="w-full max-w-3xl px-4 pb-16 pt-2 sm:px-8"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {loading ? (
          <motion.p variants={itemVariants} className="text-sm text-neutral-500">
            Loading…
          </motion.p>
        ) : sorted.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-10"
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
              <Clock size={26} />
            </div>
            <h2 className="text-base font-semibold text-neutral-100">No history yet</h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-400">
              Once you analyze a resume, every scan shows up here with its score, verdict, and
              top priorities.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-5">
              <Link href="/dashboard">Run an analysis</Link>
            </Button>
          </motion.div>
        ) : (
          <>
            <motion.p
              variants={itemVariants}
              className="mb-6 text-sm leading-relaxed text-neutral-400"
            >
              {sorted.length} resume{sorted.length === 1 ? "" : "s"} ·{" "}
              {analyzedCount} analyzed. Click any entry to expand the full verdict, ATS
              probability, and priorities from that scan.
            </motion.p>

            <motion.div variants={itemVariants}>
              <Accordion
                type="multiple"
                className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
              >
                {sorted.map(({ resume, analysis }, idx) => (
                  <motion.div
                    key={resume.id}
                    custom={idx}
                    initial="hidden"
                    animate="visible"
                    variants={rowVariants}
                  >
                    <AccordionItem
                      value={resume.id}
                      className={`border-neutral-800 ${idx === sorted.length - 1 ? "" : "border-b"}`}
                    >
                      <AccordionTrigger className="rounded-none border-0 px-5 py-4 hover:no-underline hover:bg-neutral-900/50 data-[state=open]:bg-neutral-900/40">
                        <div className="flex flex-1 items-center gap-4">
                          {/* Score block */}
                          <div className="flex shrink-0 flex-col items-center gap-1">
                            {analysis ? (
                              <>
                                <span
                                  className={`text-2xl font-bold leading-none ${scoreTone(analysis.overallScore)}`}
                                >
                                  {analysis.overallScore}
                                </span>
                                <span className="text-[10px] font-medium text-neutral-500">
                                  / 100
                                </span>
                              </>
                            ) : (
                              <span className="text-2xl font-bold leading-none text-neutral-600">
                                —
                              </span>
                            )}
                          </div>

                          {/* Title block */}
                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <FileText size={13} className="shrink-0 text-neutral-500" />
                              <span className="truncate text-sm font-semibold text-neutral-100">
                                {resume.name}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                              <Clock size={11} />
                              {analysis
                                ? `Analyzed ${relativeTime(analysis.createdAt)}`
                                : "Not analyzed yet"}
                            </div>
                          </div>

                          {/* Pills */}
                          <div className="hidden shrink-0 items-center gap-2 sm:flex">
                            {analysis?.grade && (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${GRADE_COLOR[analysis.grade] || "bg-neutral-500/15 text-neutral-300 border-neutral-500/30"}`}
                              >
                                {analysis.grade}
                              </span>
                            )}
                            {analysis?.atsPassProbability && (
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${ATS_COLOR[analysis.atsPassProbability] || ""}`}
                              >
                                ATS {analysis.atsPassProbability}
                              </span>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>

                      <AccordionContent className="px-5 pb-5 pt-0">
                        {!analysis ? (
                          <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                            <p className="text-sm text-neutral-400">
                              No analysis exists for this resume yet.
                            </p>
                            <Button asChild variant="outline" size="sm" className="mt-3">
                              <Link href="/dashboard">Run analysis</Link>
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Verdict */}
                            {analysis.verdict && (
                              <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
                                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                                  <Sparkles size={12} />
                                  Verdict
                                </div>
                                <p className="text-sm leading-relaxed text-neutral-200">
                                  &ldquo;{analysis.verdict}&rdquo;
                                </p>
                              </div>
                            )}

                            {/* Stats row */}
                            {(analysis.atsPassProbability || analysis.estimatedInterviewRate) && (
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {analysis.atsPassProbability && (
                                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                      ATS pass probability
                                    </div>
                                    <div className="mt-1 text-sm font-semibold capitalize text-neutral-100">
                                      {analysis.atsPassProbability}
                                    </div>
                                  </div>
                                )}
                                {analysis.estimatedInterviewRate && (
                                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                      Estimated interview rate
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-neutral-100">
                                      {analysis.estimatedInterviewRate}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Top priorities */}
                            {analysis.top3Priorities && analysis.top3Priorities.length > 0 && (
                              <div>
                                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                                  <Target size={12} />
                                  Top priorities
                                </div>
                                <ol className="space-y-1.5">
                                  {analysis.top3Priorities.map((p, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-200"
                                    >
                                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-300">
                                        {i + 1}
                                      </span>
                                      <span>{p}</span>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {/* Interview red flags */}
                            {analysis.interviewRedFlags && analysis.interviewRedFlags.length > 0 && (
                              <div>
                                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                                  <AlertTriangle size={12} />
                                  Interview red flags
                                </div>
                                <ul className="space-y-1.5">
                                  {analysis.interviewRedFlags.map((f, i) => (
                                    <li
                                      key={i}
                                      className="flex items-start gap-2 text-sm leading-relaxed text-neutral-300"
                                    >
                                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                                      <span>{f}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Score bars (top 5) */}
                            {analysis.bars && analysis.bars.length > 0 && (
                              <div>
                                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                                  <TrendingUp size={12} />
                                  Dimension scores
                                </div>
                                <div className="space-y-2">
                                  {analysis.bars.slice(0, 5).map((bar) => (
                                    <div key={bar.key}>
                                      <div className="mb-1 flex items-center justify-between text-xs">
                                        <span className="text-neutral-400">{bar.label}</span>
                                        <span className="font-semibold text-neutral-200">
                                          {bar.value}%
                                        </span>
                                      </div>
                                      <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{ width: `${bar.value}%` }}
                                          transition={{ duration: 0.7, ease: EASE }}
                                          className={`h-full rounded-full ${
                                            bar.value >= 70
                                              ? "bg-emerald-500"
                                              : bar.value >= 40
                                                ? "bg-amber-500"
                                                : "bg-rose-500"
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </motion.div>
                ))}
              </Accordion>

              <Separator className="mt-6 bg-neutral-900" />
              <p className="mt-3 text-xs text-neutral-500">
                Showing {sorted.length} of your scans — most recent first.
              </p>
            </motion.div>
          </>
        )}
      </motion.div>
    </SidebarShell>
  );
}
