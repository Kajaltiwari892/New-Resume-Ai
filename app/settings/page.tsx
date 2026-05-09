"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { getOnboarding, saveOnboarding, type Profile } from "@/lib/resumeClient";

export default function SettingsPage() {
  const { user, checked } = useRequireAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { profile } = await getOnboarding();
        setProfile(profile || {});
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const { profile: next } = await saveOnboarding(profile);
      setProfile(next);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => ({ ...(p || {}), [key]: value }));
  }

  if (!checked || !user) {
    return (
      <main className="app-shell">
        <div className="ambient-grid" />
      </main>
    );
  }

  return (
    <SidebarShell user={user} subtitle="Profile & preferences" title="Settings">
      <div className="shell-content">
        {loading || !profile ? (
          <p className="muted">Loading…</p>
        ) : (
          <form className="settings-form" onSubmit={handleSubmit}>
            <section className="settings-card">
              <h2>Account</h2>
              <div className="form-row">
                <label>
                  <small>Email</small>
                  <input value={user.email} disabled />
                </label>
                <label>
                  <small>Name</small>
                  <input value={user.name} disabled />
                </label>
              </div>
              <p className="muted">Account credentials can&apos;t be edited here yet.</p>
            </section>

            <section className="settings-card">
              <h2>Career profile</h2>
              <div className="form-row">
                <label>
                  <small>Job title</small>
                  <input
                    value={profile.jobTitle || ""}
                    onChange={(e) => update("jobTitle", e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </label>
                <label>
                  <small>Target role</small>
                  <input
                    value={profile.targetRole || ""}
                    onChange={(e) => update("targetRole", e.target.value)}
                    placeholder="e.g. Staff Product Engineer"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  <small>Industry</small>
                  <input
                    value={profile.industry || ""}
                    onChange={(e) => update("industry", e.target.value)}
                  />
                </label>
                <label>
                  <small>Experience level</small>
                  <select
                    value={profile.experienceLevel || ""}
                    onChange={(e) =>
                      update("experienceLevel", (e.target.value || undefined) as Profile["experienceLevel"])
                    }
                  >
                    <option value="">Select…</option>
                    <option value="Fresher">Fresher</option>
                    <option value="1-3 yrs">1-3 yrs</option>
                    <option value="3-7 yrs">3-7 yrs</option>
                    <option value="7+ yrs">7+ yrs</option>
                  </select>
                </label>
              </div>
              <label>
                <small>Dream companies (comma-separated)</small>
                <input
                  value={(profile.dreamCompanies || []).join(", ")}
                  onChange={(e) =>
                    update(
                      "dreamCompanies",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </label>
            </section>

            <div className="settings-actions">
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              {savedAt && <small className="muted">Saved.</small>}
              <Link href="/onboarding" className="ghost-button">
                Re-run onboarding
              </Link>
            </div>
          </form>
        )}
      </div>
    </SidebarShell>
  );
}
