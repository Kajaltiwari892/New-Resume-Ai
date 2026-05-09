"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import {
  generateInterviewQuestions,
  listResumes,
  type InterviewQuestion,
  type Resume,
} from "@/lib/resumeClient";
import { FiMessageSquare, FiZap } from "react-icons/fi";

export default function InterviewPage() {
  const { user, checked } = useRequireAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
    try {
      const { questions } = await generateInterviewQuestions(activeId, 5);
      setQuestions(questions);
    } finally {
      setGenerating(false);
    }
  }

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Practice common questions" title="Interview Prep">
      <div className="shell-content">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : resumes.length === 0 ? (
          <div className="empty-card">
            <FiMessageSquare size={28} />
            <h2>Add a resume first</h2>
            <p>We tailor interview questions to your experience and target role.</p>
            <Link href="/dashboard" className="primary-button">
              Go to dashboard
            </Link>
          </div>
        ) : (
          <>
            <div className="shell-toolbar">
              <label className="resume-select">
                <small>Resume</small>
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
                className="primary-button"
                disabled={generating || !activeId}
                onClick={handleGenerate}
              >
                <FiZap size={14} />
                {generating ? "Generating…" : "Generate questions"}
              </button>
            </div>

            {questions.length === 0 ? (
              <p className="muted">Click <b>Generate questions</b> to create a fresh practice set.</p>
            ) : (
              <ul className="question-list">
                {questions.map((q) => (
                  <li key={q.id} className="question-card">
                    <header>
                      <span className={`pill ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                      <small>{q.group}</small>
                    </header>
                    <p>{q.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </SidebarShell>
  );
}
