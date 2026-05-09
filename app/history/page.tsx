"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { getAnalysis, listResumes, type Analysis, type Resume } from "@/lib/resumeClient";
import { FiClock } from "react-icons/fi";

type Row = { resume: Resume; analysis: Analysis | null };

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

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Past resume scans" title="History">
      <div className="shell-content">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="empty-card">
            <FiClock size={28} />
            <h2>No history yet</h2>
            <p>Once you analyze a resume, your past scans show up here.</p>
            <Link href="/dashboard" className="primary-button">
              Run an analysis
            </Link>
          </div>
        ) : (
          <ul className="history-list">
            {rows.map(({ resume, analysis }) => (
              <li key={resume.id} className="history-row">
                <div>
                  <b>{resume.name}</b>
                  <small>
                    {analysis
                      ? `Last analyzed ${new Date(analysis.createdAt).toLocaleString()}`
                      : "Not analyzed yet"}
                  </small>
                </div>
                <div className="history-score">
                  {analysis ? (
                    <>
                      <strong>{analysis.overallScore}</strong>
                      <span>/100</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidebarShell>
  );
}
