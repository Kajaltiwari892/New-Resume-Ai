"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import {
  generateInterviewQuestions,
  listResumes,
  type InterviewQuestion,
  type Resume,
} from "@/lib/resumeClient";
import { FiArrowRight, FiMessageSquare, FiZap } from "react-icons/fi";

const DIFFICULTY_TONE: Record<string, string> = {
  easy: "easy",
  medium: "medium",
  hard: "hard",
};

export default function InterviewPage() {
  const { user, checked } = useRequireAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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

  async function handleGenerate() {
    if (!activeId) return;
    setGenerating(true);
    setErrorMsg(null);
    try {
      const { questions } = await generateInterviewQuestions(activeId, 5);
      setQuestions(questions);
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

  const grouped = useMemo(() => {
    const map = new Map<string, InterviewQuestion[]>();
    for (const q of questions) {
      const key = q.group || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    return Array.from(map.entries());
  }, [questions]);

  const activeResume = resumes.find((r) => r.id === activeId);

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Practice common questions" title="Interview Prep">
      <div className="interview-page">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : resumes.length === 0 ? (
          <div className="interview-empty">
            <div className="interview-empty-icon">
              <FiMessageSquare size={32} />
            </div>
            <h2>Add a resume first</h2>
            <p>We tailor interview questions to your experience and target role.</p>
            <Link href="/dashboard" className="cta-button">
              Go to Dashboard <FiArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <>
            <header className="interview-hero">
              <div className="interview-hero-text">
                <h2>Mock interview, on demand</h2>
                <p>
                  Generate a fresh set of questions tailored to{" "}
                  {activeResume ? <b>{activeResume.name}</b> : "your resume"}. Practice answering
                  aloud, then come back for another set.
                </p>
              </div>

              <div className="interview-hero-controls">
                <label className="interview-select">
                  <small>Using resume</small>
                  <select value={activeId} onChange={(e) => setActiveId(e.target.value)}>
                    {resumes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="cta-button"
                  disabled={generating || !activeId}
                  onClick={handleGenerate}
                >
                  <FiZap size={14} />
                  {generating
                    ? "Generating…"
                    : questions.length > 0
                      ? "Generate new set"
                      : "Generate questions"}
                </button>
              </div>
            </header>

            {errorMsg && <div className="interview-error">{errorMsg}</div>}

            {questions.length === 0 ? (
              <div className="interview-placeholder">
                <FiMessageSquare size={28} />
                <h3>No questions yet</h3>
                <p>
                  Hit <b>Generate questions</b> above to create your first practice set.
                </p>
              </div>
            ) : (
              <div className="interview-groups">
                {grouped.map(([group, items]) => (
                  <section key={group} className="interview-group">
                    <header className="interview-group-head">
                      <h3>{group}</h3>
                      <span className="interview-group-count">
                        {items.length} question{items.length === 1 ? "" : "s"}
                      </span>
                    </header>
                    <ol className="interview-question-list">
                      {items.map((q, i) => (
                        <li key={q.id} className="interview-question">
                          <div className="interview-question-num">{i + 1}</div>
                          <div className="interview-question-body">
                            <p>{q.text}</p>
                            <span
                              className={`interview-pill ${
                                DIFFICULTY_TONE[q.difficulty.toLowerCase()] || "medium"
                              }`}
                            >
                              {q.difficulty}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </SidebarShell>
  );
}
