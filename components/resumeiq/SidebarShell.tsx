"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiClock,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiMenu,
  FiMessageSquare,
  FiPlus,
  FiSettings,
  FiX,
} from "react-icons/fi";
import { FileSearch } from "lucide-react";
import { logout, type PublicUser } from "@/lib/authClient";

const NAV_ITEMS = [
  { href: "/dashboard", icon: FiGrid, label: "Dashboard" },
  { href: "/resumes", icon: FiFileText, label: "My Resumes" },
  { href: "/interview", icon: FiMessageSquare, label: "Interview Prep" },
  { href: "/history", icon: FiClock, label: "History" },
  { href: "/settings", icon: FiSettings, label: "Settings" },
] as const;

function planLabel(plan?: string) {
  if (plan === "pro") return "Pro plan";
  if (plan === "plus") return "Plus plan";
  return "Free plan";
}

function initialsOf(name: string, email: string) {
  const src = (name || email || "U").trim();
  return src
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function SidebarShell({
  user,
  title,
  subtitle,
  children,
}: {
  user: PublicUser;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isPaid = user.plan === "plus" || user.plan === "pro";

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const headerName = user.name || user.email;

  async function handleLogout() {
    try {
      await logout();
    } finally {
      router.replace("/auth");
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
      <section className={`dashboard sidebar-shell ${mobileNavOpen ? "nav-open" : ""}`}>
        {mobileNavOpen && (
          <div
            className="mobile-nav-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
        )}
        <aside className="sidebar">
          <div className="sidebar-scroll">
            <div className="brand-mark">
              <span className="brand-glyph">
                <FileSearch size={14} strokeWidth={1.8} />
              </span>
              <strong>ResumeIQ</strong>
              <button
                type="button"
                className="ghost-button mobile-nav-close"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                <FiX size={16} />
              </button>
            </div>
            <nav>
              <Link
                href="/dashboard"
                className="sidebar-new-score"
                onClick={() => setMobileNavOpen(false)}
              >
                <FiPlus size={16} />
                <span>Check New Resume Score</span>
              </Link>
              {NAV_ITEMS.map(({ href, icon: NavIcon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={pathname === href ? "active" : ""}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <NavIcon size={16} />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <div className="upgrade-card">
              <b>{isPaid ? "Your plan" : "Upgrade your plan"}</b>
              <p>
                {isPaid
                  ? "Manage your subscription or switch tiers anytime."
                  : "Unlock unlimited AI rewrites and interview drills."}
              </p>
              <button onClick={() => { setMobileNavOpen(false); router.push("/pricing"); }}>
                {isPaid ? "Manage plan" : "See plans"}
              </button>
            </div>
            <div className="profile-card">
              <span>{initialsOf(user.name, user.email)}</span>
              <div>
                <b>{headerName}</b>
                <small>{planLabel(user.plan)}</small>
              </div>
              <button
                type="button"
                className="ghost-button sidebar-logout"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
              >
                <FiLogOut size={14} />
              </button>
            </div>
          </div>
        </aside>

        <section className="resume-workbench shell-main">
          <div className="topbar">
            <button
              type="button"
              className="ghost-button mobile-nav-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <FiMenu size={18} />
            </button>
            <div>
              {subtitle && <small>{subtitle}</small>}
              <h1>{title}</h1>
            </div>
          </div>
          {children}
        </section>
      </section>
    </main>
  );
}
