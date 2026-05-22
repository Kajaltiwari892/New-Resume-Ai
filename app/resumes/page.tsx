"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { listResumes, deleteResume, type Resume } from "@/lib/resumeClient";
import {
  FiCalendar,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiPlus,
  FiTrash2,
  FiType,
} from "react-icons/fi";

type FileKind = "pdf" | "docx" | "text";

function fileKind(r: Resume): FileKind {
  if (r.source === "paste") return "text";
  const mime = (r.mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word") || mime.includes("officedocument")) return "docx";
  return "text";
}

function fileKindLabel(kind: FileKind) {
  if (kind === "pdf") return "PDF";
  if (kind === "docx") return "DOCX";
  return "Text";
}

function wordCount(r: Resume): number {
  const text =
    r.rawText ||
    [r.sections?.summary, r.sections?.experience, r.sections?.skills, r.sections?.education]
      .filter(Boolean)
      .join(" ");
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function absoluteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

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

  const sorted = useMemo(
    () =>
      [...resumes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [resumes],
  );

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
      <div className="resumes-page">
        <div className="resumes-toolbar">
          <div className="resumes-toolbar-meta">
            <b>{resumes.length}</b>
            <span>resume{resumes.length === 1 ? "" : "s"} in your library</span>
          </div>
          <Link href="/dashboard" className="resumes-new-btn">
            <FiPlus size={14} /> New resume
          </Link>
        </div>

        {loading ? (
          <div className="resumes-grid">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="resume-card resume-card-skeleton">
                <div className="resume-card-thumb" />
                <div className="resume-card-body">
                  <span className="skeleton-line skeleton-line-lg" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="resumes-empty">
            <div className="resumes-empty-icon">
              <FiFileText size={32} />
            </div>
            <h2>No resumes yet</h2>
            <p>Upload a PDF or DOCX, or paste your resume text, to start scoring.</p>
            <Link href="/dashboard" className="resumes-new-btn">
              <FiPlus size={14} /> Create your first resume
            </Link>
          </div>
        ) : (
          <div className="resumes-grid">
            {sorted.map((r) => {
              const kind = fileKind(r);
              const words = wordCount(r);
              return (
                <article key={r.id} className={`resume-card kind-${kind}`}>
                  <div className="resume-card-head">
                    <div className={`resume-card-thumb kind-${kind}`}>
                      {kind === "text" ? (
                        <FiType size={22} />
                      ) : (
                        <FiFileText size={22} />
                      )}
                      <span className="resume-card-kind">{fileKindLabel(kind)}</span>
                    </div>
                    {r.active && <span className="resume-card-active-badge">Active</span>}
                  </div>

                  <div className="resume-card-body">
                    <h3 className="resume-card-name" title={r.name}>
                      {r.name}
                    </h3>
                    <p className="resume-card-source">
                      {r.source === "file" ? "Uploaded file" : "Pasted text"}
                    </p>

                    <ul className="resume-card-meta">
                      <li>
                        <FiCalendar size={12} />
                        <span>Uploaded {absoluteDate(r.createdAt)}</span>
                      </li>
                      {words > 0 && (
                        <li>
                          <FiEdit3 size={12} />
                          <span>
                            {words.toLocaleString()} word{words === 1 ? "" : "s"}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>

                  <div className="resume-card-actions">
                    <Link href="/dashboard" className="resume-card-open">
                      <FiExternalLink size={14} /> Open
                    </Link>
                    <button
                      type="button"
                      className="resume-card-delete"
                      onClick={() => handleDelete(r.id)}
                      disabled={busyId === r.id}
                      aria-label="Delete resume"
                      title="Delete resume"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SidebarShell>
  );
}
