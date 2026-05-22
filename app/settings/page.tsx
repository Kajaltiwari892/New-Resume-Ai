"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Briefcase,
  Building2,
  Check,
  ExternalLink,
  Save,
  Target,
  User as UserIcon,
  X,
} from "lucide-react";
import SidebarShell from "@/components/resumeiq/SidebarShell";
import { useRequireAuth } from "@/components/resumeiq/useRequireAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getOnboarding, saveOnboarding, type Profile } from "@/lib/resumeClient";

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const EXPERIENCE_OPTIONS: Array<{ value: NonNullable<Profile["experienceLevel"]>; label: string }> = [
  { value: "Fresher", label: "Fresher" },
  { value: "1-3 yrs", label: "1–3 years" },
  { value: "3-7 yrs", label: "3–7 years" },
  { value: "7+ yrs", label: "7+ years" },
];

function FieldInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  type = "text",
}: {
  id: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:bg-neutral-900/40 disabled:text-neutral-500"
    />
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      variants={itemVariants}
      className="rounded-xl border border-neutral-800 bg-neutral-950"
    >
      <header className="flex items-start gap-3 border-b border-neutral-900 px-5 py-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-violet-300">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-100">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{description}</p>
          )}
        </div>
      </header>
      <div className="px-5 py-5">{children}</div>
    </motion.section>
  );
}

export default function SettingsPage() {
  const { user, checked } = useRequireAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState("");

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

  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(null), 2400);
    return () => window.clearTimeout(t);
  }, [savedAt]);

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

  function addCompany() {
    const name = companyDraft.trim();
    if (!name) return;
    const list = profile?.dreamCompanies || [];
    if (list.includes(name)) {
      setCompanyDraft("");
      return;
    }
    update("dreamCompanies", [...list, name]);
    setCompanyDraft("");
  }

  function removeCompany(name: string) {
    const list = profile?.dreamCompanies || [];
    update(
      "dreamCompanies",
      list.filter((c) => c !== name),
    );
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
      <motion.div
        className="w-full max-w-3xl px-8 pb-16 pt-2"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {loading || !profile ? (
          <motion.p variants={itemVariants} className="text-sm text-neutral-500">
            Loading…
          </motion.p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.p
              variants={itemVariants}
              className="mb-6 text-sm leading-relaxed text-neutral-400"
            >
              Keep your profile fresh so we can tailor every analysis, suggestion, and interview
              question to where you&apos;re heading next.
            </motion.p>

            {/* Account */}
            <SectionCard
              icon={UserIcon}
              title="Account"
              description="Read-only for now — credentials can't be edited here yet."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-neutral-400">
                    Email
                  </Label>
                  <FieldInput id="email" value={user.email} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-neutral-400">
                    Name
                  </Label>
                  <FieldInput id="name" value={user.name || ""} disabled />
                </div>
              </div>
            </SectionCard>

            {/* Career profile */}
            <SectionCard
              icon={Briefcase}
              title="Career profile"
              description="Your current role and where you want to go — used to score relevance and tailor questions."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="jobTitle" className="text-xs font-medium text-neutral-400">
                    Job title
                  </Label>
                  <FieldInput
                    id="jobTitle"
                    value={profile.jobTitle || ""}
                    onChange={(v) => update("jobTitle", v)}
                    placeholder="e.g. Senior Frontend Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="targetRole" className="text-xs font-medium text-neutral-400">
                    Target role
                  </Label>
                  <FieldInput
                    id="targetRole"
                    value={profile.targetRole || ""}
                    onChange={(v) => update("targetRole", v)}
                    placeholder="e.g. Staff Product Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry" className="text-xs font-medium text-neutral-400">
                    Industry
                  </Label>
                  <FieldInput
                    id="industry"
                    value={profile.industry || ""}
                    onChange={(v) => update("industry", v)}
                    placeholder="e.g. SaaS, Fintech"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-neutral-400">Experience level</Label>
                  <Select
                    value={profile.experienceLevel || ""}
                    onValueChange={(v) =>
                      update("experienceLevel", (v || undefined) as Profile["experienceLevel"])
                    }
                  >
                    <SelectTrigger className="h-10 w-full border-neutral-800 bg-neutral-950 text-sm text-neutral-100 hover:bg-neutral-900">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent className="border-neutral-800 bg-neutral-950 text-neutral-100">
                      {EXPERIENCE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SectionCard>

            {/* Dream companies */}
            <SectionCard
              icon={Building2}
              title="Dream companies"
              description="Companies you'd love to work for. We use these to bias scoring and interview prep."
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={companyDraft}
                  onChange={(e) => setCompanyDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCompany();
                    }
                  }}
                  placeholder="Type a company and press Enter…"
                  className="h-10 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-3 text-sm text-neutral-100 placeholder:text-neutral-600 transition-colors focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
                <Button
                  type="button"
                  onClick={addCompany}
                  variant="outline"
                  size="lg"
                  disabled={!companyDraft.trim()}
                  className="h-10 border-neutral-700 bg-transparent px-4 text-sm text-neutral-100 hover:bg-neutral-900 hover:text-white"
                >
                  Add
                </Button>
              </div>

              <AnimatePresence initial={false}>
                {profile.dreamCompanies && profile.dreamCompanies.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AnimatePresence initial={false}>
                        {profile.dreamCompanies.map((c) => (
                          <motion.span
                            key={c}
                            layout
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 py-1 pl-3 pr-1 text-xs font-medium text-violet-200"
                          >
                            {c}
                            <button
                              type="button"
                              onClick={() => removeCompany(c)}
                              aria-label={`Remove ${c}`}
                              className="grid h-5 w-5 place-items-center rounded-full text-violet-300/80 hover:bg-violet-500/20 hover:text-violet-100"
                            >
                              <X size={11} />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>

            {/* Onboarding shortcut */}
            <SectionCard
              icon={Target}
              title="Re-run onboarding"
              description="Refresh your goals, priorities, and resume type from scratch."
            >
              <Button asChild variant="outline" size="lg" className="h-10 gap-2">
                <Link href="/onboarding">
                  Open onboarding
                  <ExternalLink size={14} />
                </Link>
              </Button>
            </SectionCard>

            <Separator className="bg-neutral-900" />

            {/* Save bar */}
            <motion.div variants={itemVariants} className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={saving}
                size="lg"
                variant="outline"
                className="h-11 gap-2 border-neutral-700 bg-transparent px-5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 hover:text-white"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save changes"}
              </Button>

              <AnimatePresence>
                {savedAt && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.2, ease: EASE }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300"
                  >
                    <Check size={13} />
                    Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </form>
        )}
      </motion.div>
    </SidebarShell>
  );
}
