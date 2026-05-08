"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardApp from "@/components/resumeiq/DashboardApp";
import { bootstrapSession, type PublicUser } from "@/lib/authClient";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await bootstrapSession();
        if (cancelled) return;
        if (!current) {
          router.replace("/auth");
          return;
        }
        setUser(current);
      } catch {
        if (!cancelled) router.replace("/auth");
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
        <section className="analysis-overlay">
          <div className="loader-card glass-panel">
            <h1>Loading your workspace…</h1>
            <p>Verifying your session.</p>
            <div className="skeleton-stack">
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <DashboardApp user={user} />;
}
