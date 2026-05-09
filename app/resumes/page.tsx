"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { listResumes, deleteResume, type Resume } from "@/lib/resumeClient";
import { FiFileText, FiTrash2, FiPlus } from "react-icons/fi";

export default function ResumesPage() {
  const { user, checked } = useRequireAuth();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { resumes } = await listResumes();
        if (!cancelled) setResumes(resumes);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this resume permanently?")) return;
    setBusyId(id);
    try {
      await deleteResume(id);
      setResumes((rs) => rs.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
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
    <SidebarShell user={user} subtitle="All of your resumes" title="My Resumes">
      <div className="shell-content">
        <div className="shell-toolbar">
          <p>{resumes.length} resume{resumes.length === 1 ? "" : "s"}</p>
          <Link href="/dashboard" className="primary-button">
            <FiPlus size={14} /> New resume
          </Link>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : resumes.length === 0 ? (
          <div className="empty-card">
            <FiFileText size={28} />
            <h2>No resumes yet</h2>
            <p>Upload or paste your first resume to get a tailored analysis.</p>
            <Link href="/dashboard" className="primary-button">
              Create resume
            </Link>
          </div>
        ) : (
          <ul className="resume-list">
            {resumes.map((r) => (
              <li key={r.id} className="resume-list-item">
                <Link href="/dashboard" className="resume-list-main">
                  <FiFileText size={20} />
                  <div>
                    <b>{r.name}</b>
                    <small>
                      {r.source === "file" ? "Uploaded file" : "Pasted text"} ·
                      Updated {new Date(r.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                </Link>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => handleDelete(r.id)}
                  disabled={busyId === r.id}
                  aria-label="Delete resume"
                >
                  <FiTrash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidebarShell>
  );
}
