"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Plus, Zap } from "lucide-react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  generateInterviewQuestions,
  listInterviewQuestions,
  listResumes,
  type InterviewDifficulty,
  type InterviewQuestion,
  type Resume,
} from "@/lib/resumeClient";

type FilterDifficulty = "All" | "Easy" | "Medium" | "Hard";

function difficultyTone(difficulty: string): string {
  const d = difficulty.toLowerCase();
  if (d === "easy") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (d === "hard") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

const EASE = [0.22, 1, 0.36, 1] as const;
const DIFFICULTIES: InterviewDifficulty[] = ["Mixed", "Easy", "Medium", "Hard"];
const FILTERS: FilterDifficulty[] = ["All", "Easy", "Medium", "Hard"];
const GROUP_ORDER: InterviewQuestion["group"][] = [
  "Behavioral",
  "Technical",
  "Role-Specific",
  "Culture Fit",
  "Resume-Based",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};
const groupVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE, delay: i * 0.06 },
  }),
};
const questionVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: EASE, delay: i * 0.03 },
  }),
};

/** Gradient-wave Generate button — solid dark at rest, soft light gradient on hover/busy. */
function GenerateButton({
  busy,
  disabled,
  onClick,
  children,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const active = busy || hovered;
  const duration = busy ? 2 : 3.5;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={disabled}
      whileTap={{ scale: 0.98 }}
      className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950 px-5 text-sm font-medium text-neutral-100 transition-colors hover:border-violet-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {/* Soft, low-opacity gradient wave — only visible on hover/busy */}
      <motion.span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #7c3aed, #06b6d4, #ec4899, #f59e0b, #7c3aed)",
          backgroundSize: "300% 100%",
        }}
        animate={{
          opacity: active ? (busy ? 0.28 : 0.18) : 0,
          backgroundPositionX: ["0%", "300%"],
        }}
        transition={{
          opacity: { duration: 0.4, ease: "easeOut" },
          backgroundPositionX: { duration, ease: "linear", repeat: Infinity },
        }}
      />
      {/* Diagonal sheen overlay — barely there, just a hint of light moving */}
      <motion.span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.10) 50%, transparent 65%)",
          backgroundSize: "200% 100%",
        }}
        animate={{
          opacity: active ? 1 : 0,
          backgroundPositionX: ["-100%", "200%"],
        }}
        transition={{
          opacity: { duration: 0.4 },
          backgroundPositionX: {
            duration: busy ? 1.2 : 2.2,
            ease: "linear",
            repeat: Infinity,
          },
        }}
      />
      {/* Content sits above the gradients */}
      <span className="relative z-10 inline-flex items-center gap-2">
        <motion.span
          animate={busy ? { rotate: 360 } : { rotate: 0 }}
          transition={
            busy ? { duration: 1, ease: "linear", repeat: Infinity } : { duration: 0.3 }
          }
          className="inline-flex"
        >
          <Zap size={14} />
        </motion.span>
        {children}
      </span>
    </motion.button>
  );
}

export default function InterviewPage() {
  const { user, checked } = useRequireAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("Mixed");
  const [filter, setFilter] = useState<FilterDifficulty>("All");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const [openAnswers, setOpenAnswers] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { resumes } = await listResumes();
        setResumes(resumes);
        if (resumes[0]) setActiveId(resumes[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Hydrate questions whenever the active resume changes.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setHydrating(true);
    setQuestions([]);
    setOpenAnswers({});
    (async () => {
      try {
        const { questions } = await listInterviewQuestions(activeId);
        if (!cancelled) setQuestions(questions);
      } catch {
        if (!cancelled) setQuestions([]);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function handleGenerate() {
    if (!activeId) return;
    setGenerating(true);
    setErrorMsg(null);
    try {
      const { questions: fresh } = await generateInterviewQuestions(activeId, {
        count: 10,
        difficulty,
      });
      // Append to existing rather than replace — questions persist server-side.
      setQuestions((curr) => [...fresh, ...curr]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Couldn't generate questions just now. Try again.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleLoadMore(group: InterviewQuestion["group"]) {
    if (!activeId) return;
    setLoadingMore(group);
    setErrorMsg(null);
    try {
      const { questions: more } = await generateInterviewQuestions(activeId, {
        count: 5,
        difficulty,
        group,
      });
      setQuestions((curr) => [...more, ...curr]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : `Couldn't load more ${group} questions. Try again.`,
      );
    } finally {
      setLoadingMore(null);
    }
  }

  // Apply difficulty filter for display.
  const filtered = useMemo(
    () =>
      filter === "All"
        ? questions
        : questions.filter((q) => q.difficulty === filter),
    [questions, filter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, InterviewQuestion[]>();
    for (const q of filtered) {
      const key = q.group || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [filtered]);

  // Counts per filter (based on raw, not filtered, so the badges stay informative).
  const counts = useMemo(() => {
    const c = { All: questions.length, Easy: 0, Medium: 0, Hard: 0 } as Record<
      FilterDifficulty,
      number
    >;
    for (const q of questions) {
      if (q.difficulty === "Easy" || q.difficulty === "Medium" || q.difficulty === "Hard") {
        c[q.difficulty] += 1;
      }
    }
    return c;
  }, [questions]);

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Practice common questions" title="Interview Prep">
      <motion.div
        className="w-full max-w-3xl px-8 pb-16 pt-2"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {loading ? (
          <motion.p variants={itemVariants} className="text-sm text-neutral-500">
            Loading…
          </motion.p>
        ) : resumes.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-neutral-800 bg-neutral-950 p-10"
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
              <MessageSquare size={26} />
            </div>
            <h2 className="text-base font-semibold text-neutral-100">Add a resume first</h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-400">
              We tailor interview questions to your experience and target role.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-5">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </motion.div>
        ) : (
          <>
            <motion.p
              variants={itemVariants}
              className="mb-6 text-sm leading-relaxed text-neutral-400"
            >
              Generate a fresh set of questions tailored to your resume — with model answers and
              a difficulty you control. Practice answering out loud, then come back for another set.
            </motion.p>

            <motion.div variants={itemVariants} className="mb-6 flex flex-wrap items-end gap-3">
              {/* Resume picker */}
              <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Using resume
                </label>
                <Select value={activeId} onValueChange={setActiveId}>
                  <SelectTrigger className="h-11 w-full border-neutral-800 bg-neutral-950 text-sm text-neutral-100 hover:bg-neutral-900">
                    <SelectValue placeholder="Pick a resume" />
                  </SelectTrigger>
                  <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                    {resumes.map((r, i) => (
                      <Fragment key={r.id}>
                        {i > 0 && <SelectSeparator className="bg-neutral-800" />}
                        <SelectItem value={r.id}>{r.name}</SelectItem>
                      </Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty picker (for generation) */}
              <div className="flex min-w-[160px] flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Generate as
                </label>
                <Select
                  value={difficulty}
                  onValueChange={(v) => setDifficulty(v as InterviewDifficulty)}
                >
                  <SelectTrigger className="h-11 w-full border-neutral-800 bg-neutral-950 text-sm text-neutral-100 hover:bg-neutral-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                    {DIFFICULTIES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate */}
              <GenerateButton
                busy={generating}
                disabled={generating || !activeId}
                onClick={handleGenerate}
              >
                {generating
                  ? "Generating…"
                  : questions.length > 0
                    ? "Generate more"
                    : "Generate questions"}
              </GenerateButton>
            </motion.div>

            {/* Filter chips (display-only) */}
            {questions.length > 0 && (
              <motion.div variants={itemVariants} className="mb-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Show
                </span>
                {FILTERS.map((f) => {
                  const active = filter === f;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                          : "border-neutral-800 bg-neutral-950 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                      }`}
                    >
                      {f}
                      <span
                        className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                          active ? "bg-violet-500/25 text-violet-100" : "bg-neutral-900 text-neutral-500"
                        }`}
                      >
                        {counts[f]}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="mb-6 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                >
                  {errorMsg}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {hydrating && questions.length === 0 ? (
                <motion.p
                  key="hydrating"
                  variants={itemVariants}
                  className="text-sm text-neutral-500"
                >
                  Loading your previous questions…
                </motion.p>
              ) : grouped.length === 0 ? (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/50 px-6 py-12"
                >
                  <MessageSquare size={26} className="text-violet-300/80" />
                  <h3 className="mt-3 text-sm font-semibold text-neutral-100">
                    {questions.length === 0
                      ? "No questions yet"
                      : `No ${filter} questions yet`}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-500">
                    {questions.length === 0 ? (
                      <>
                        Hit <span className="text-neutral-300">Generate questions</span> above to
                        create your first practice set.
                      </>
                    ) : (
                      <>Switch the filter back to <span className="text-neutral-300">All</span> or generate more.</>
                    )}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <Accordion
                    type="multiple"
                    defaultValue={grouped.map(([g]) => g)}
                    className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950"
                  >
                    {grouped.map(([group, items], idx) => (
                      <motion.div
                        key={group}
                        custom={idx}
                        initial="hidden"
                        animate="visible"
                        variants={groupVariants}
                      >
                        <AccordionItem
                          value={group}
                          className={`border-neutral-800 ${idx === grouped.length - 1 ? "" : "border-b"}`}
                        >
                          <AccordionTrigger className="rounded-none border-0 px-5 py-4 text-[15px] font-semibold text-neutral-100 hover:no-underline hover:bg-neutral-900/50 data-[state=open]:bg-neutral-900/40">
                            <span className="flex items-center gap-3">
                              <span>{group}</span>
                              <span className="text-xs font-normal text-neutral-500">
                                {items.length} question{items.length === 1 ? "" : "s"}
                              </span>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent className="px-0 pb-0">
                            <ol className="divide-y divide-neutral-900">
                              {items.map((q, i) => {
                                const open = !!openAnswers[q.id];
                                return (
                                  <motion.li
                                    key={q.id}
                                    custom={i}
                                    initial="hidden"
                                    animate="visible"
                                    variants={questionVariants}
                                    className="flex items-start gap-3 px-5 py-4"
                                  >
                                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-300">
                                      {i + 1}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-sm leading-relaxed text-neutral-200">
                                        {q.text}
                                      </p>
                                      <div className="mt-2 flex items-center gap-2">
                                        <span
                                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${difficultyTone(q.difficulty)}`}
                                        >
                                          {q.difficulty}
                                        </span>
                                        {q.answer && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setOpenAnswers((s) => ({
                                                ...s,
                                                [q.id]: !s[q.id],
                                              }))
                                            }
                                            className="text-[11px] font-medium text-violet-300 hover:text-violet-200"
                                          >
                                            {open ? "Hide answer" : "Show answer"}
                                          </button>
                                        )}
                                      </div>
                                      <AnimatePresence initial={false}>
                                        {open && q.answer && (
                                          <motion.div
                                            key="answer"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3, ease: EASE }}
                                            className="overflow-hidden"
                                          >
                                            <div className="mt-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-sm leading-relaxed text-neutral-300">
                                              {q.answer}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </motion.li>
                                );
                              })}
                            </ol>
                            <div className="border-t border-neutral-900 px-5 py-3">
                              <Button
                                onClick={() => handleLoadMore(group as InterviewQuestion["group"])}
                                disabled={loadingMore === group}
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                              >
                                <Plus size={12} />
                                {loadingMore === group ? "Loading…" : `Load 5 more ${group}`}
                              </Button>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </motion.div>
                    ))}
                  </Accordion>

                  <Separator className="mt-6 bg-neutral-900" />
                  <p className="mt-3 text-xs text-neutral-500">
                    {filter === "All"
                      ? `Total: ${questions.length} question${questions.length === 1 ? "" : "s"}`
                      : `Showing ${filtered.length} ${filter} of ${questions.length} total`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </SidebarShell>
  );
}
