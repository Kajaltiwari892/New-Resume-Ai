"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ComponentType } from "react";
import {
  FiActivity,
  FiEdit3,
  FiTarget,
  FiMail,
  FiMessageCircle,
  FiDownload,
  FiCheckCircle,
} from "react-icons/fi";

const trustLogos = ["Stripe", "Linear", "Notion", "Arc", "Figma"];

type IconComp = ComponentType<{ size?: number | string }>;

const features: {
  title: string;
  copy: string;
  Icon: IconComp;
  tint: string;
}[] = [
  {
    title: "ATS Score Engine",
    copy: "Real-time scoring against the exact parsers recruiters use. See what gets filtered out before you ever hit submit.",
    Icon: FiActivity,
    tint: "from-violet-400/70 to-fuchsia-400/70",
  },
  {
    title: "AI Bullet Rewriter",
    copy: "Turn vague descriptions into quantified, recruiter-ready impact statements — in the voice of hired candidates.",
    Icon: FiEdit3,
    tint: "from-cyan-400/70 to-sky-400/70",
  },
  {
    title: "Keyword Radar",
    copy: "Paste any job post. We surface the missing skills and one-click inject them where they actually belong.",
    Icon: FiTarget,
    tint: "from-emerald-400/70 to-cyan-400/70",
  },
  {
    title: "Cover Letter Copilot",
    copy: "A tailored, role-specific cover letter in twelve seconds. Your voice, sharpened — not replaced.",
    Icon: FiMail,
    tint: "from-amber-400/70 to-rose-400/70",
  },
  {
    title: "Interview Coach",
    copy: "Mock interviews that read your resume. Behavioural, technical, and situational prompts tuned to the role.",
    Icon: FiMessageCircle,
    tint: "from-fuchsia-400/70 to-indigo-400/70",
  },
  {
    title: "One-Click Export",
    copy: "PDF, DOCX, or ATS-plain text. Parser-safe layouts. No mangled sections, no dropped dates.",
    Icon: FiDownload,
    tint: "from-sky-400/70 to-violet-400/70",
  },
];

export default function LandingPage() {
  return (
    <main className="marketing-shell">
      <div className="ambient-grid" />
      <AuroraBackdrop />

      <header className="marketing-nav">
        <Link className="nav-brand" href="/">
          ResumeIQ
        </Link>
        <div className="nav-actions">
          <Link className="nav-cta" href="/auth">
            Login
          </Link>
        </div>
      </header>

      <section className="landing-hero-v2">
        <div className="hero-copy">
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="hero-title font-rubik"
          >
            <span className="aurora-text">Ladies and Gentlemen,</span>
            <br />
            <span className="aurora-text aurora-text--alt">Check This Out</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7 }}
            className="hero-sub"
          >
            Stop guessing. Start getting hired. ResumeIQ is the AI career suite
            that reverse-engineers what recruiters — and their robots — are
            actually looking for.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55, type: "spring", stiffness: 120, damping: 14 }}
            className="hero-cta-row"
          >
            <Link className="primary-button" href="/auth">
              Build Your Future Now
            </Link>
          </motion.div>
        </div>

        <HeroGraphic />
      </section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="trust-band"
      >
        <p>Loved by operators and builders at</p>
        <div>
          {trustLogos.map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
      </motion.section>

      <section className="narrative-section">
        <motion.header
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="narrative-title">
            Everything you need to{" "}
            <span className="aurora-text aurora-text--alt">get hired faster.</span>
          </h2>
          <p className="narrative-sub">
            Six tools working together — from the first bullet point to the
            offer call. No more juggling tabs, templates, and half-finished
            drafts.
          </p>
        </motion.header>

        <div className="feature-grid-v2">
          {features.map((feature, idx) => {
            const Icon = feature.Icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  delay: idx * 0.08,
                  duration: 0.55,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -6 }}
                className="feature-card-v2"
              >
                <div className={`feature-icon-wrap bg-gradient-to-br ${feature.tint}`}>
                  <Icon size={26} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8 }}
        className="proof-section"
      >
        <article className="precision-card">
          <span>Why ResumeIQ</span>
          <h2>Built from the patterns inside 10M hired resumes.</h2>
          <p>
            We didn&apos;t guess. We studied the resumes that actually cleared
            filters, got replies, and landed offers — then turned every pattern
            into a tool you can use in one click.
          </p>
          <div className="used-by">
            <i />
            <i />
            <i />
            <b>Trusted by engineers, designers, and operators</b>
          </div>
        </article>

        <div className="metric-stack">
          <motion.article whileHover={{ scale: 1.02, y: -4 }}>
            <span className="metric-icon cyan" />
            <strong>3×</strong>
            <h3>More interview callbacks</h3>
            <p>Users report a meaningful spike in recruiter reach-outs within the first 48 hours.</p>
          </motion.article>
          <motion.article whileHover={{ scale: 1.02, y: -4 }}>
            <span className="metric-icon" />
            <strong>99%</strong>
            <h3>ATS match rate</h3>
            <p>Our parser matches the largest ATS vendors with 99.4% accuracy — verified weekly.</p>
          </motion.article>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="final-cta"
      >
        <h2>Ready to dominate the market?</h2>
        <p>Join the professionals who stopped applying into the void.</p>
        <Link className="primary-button" href="/auth">
          Get Started — Free
        </Link>
        <small>No credit card. Cancel anytime.</small>
      </motion.section>

      <footer className="marketing-footer">
        <small>© 2026 ResumeIQ. Built for the ambitious.</small>
        <nav>
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Support</Link>
        </nav>
        <div className="footer-icons">
          <span />
          <span />
        </div>
      </footer>
    </main>
  );
}

function AuroraBackdrop() {
  return (
    <div className="aurora-backdrop" aria-hidden>
      <span className="aurora-blob aurora-blob-1" />
      <span className="aurora-blob aurora-blob-2" />
      <span className="aurora-blob aurora-blob-3" />
    </div>
  );
}

function HeroGraphic() {
  const reduce = useReducedMotion();
  const float = reduce
    ? {}
    : {
        animate: { y: [0, -12, 0] },
        transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
      };
  const floatSlow = reduce
    ? {}
    : {
        animate: { y: [0, -8, 0] },
        transition: { duration: 8, repeat: Infinity, ease: "easeInOut" as const },
      };
  const spin = reduce
    ? {}
    : {
        animate: { rotate: 360 },
        transition: { duration: 24, repeat: Infinity, ease: "linear" as const },
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.25, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      className="hero-graphic"
    >
      <motion.div className="hero-ring" {...spin} aria-hidden />

      <motion.div className="hero-card hero-card--main" {...float}>
        <div className="hero-card-head">
          <span className="hero-avatar" />
          <div>
            <b>ATS Score</b>
            <small>Senior Engineer</small>
          </div>
          <div className="hero-score">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <circle cx="24" cy="24" r="20" stroke="rgba(255,255,255,0.12)" strokeWidth="4" fill="none" />
              <motion.circle
                cx="24"
                cy="24"
                r="20"
                stroke="url(#scoreGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
                strokeDasharray="125.6"
                initial={{ strokeDashoffset: 125.6 }}
                animate={{ strokeDashoffset: 15 }}
                transition={{ duration: 1.8, delay: 0.8, ease: "easeOut" }}
                transform="rotate(-90 24 24)"
              />
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#c4b5fd" />
                </linearGradient>
              </defs>
            </svg>
            <em>92</em>
          </div>
        </div>
        <div className="hero-bars">
          {[72, 88, 64, 95].map((w, i) => (
            <div key={i} className="hero-bar-row">
              <span />
              <motion.i
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ duration: 1.1, delay: 0.5 + i * 0.15, ease: "easeOut" }}
              />
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div className="hero-chip hero-chip--keyword" {...floatSlow}>
        <FiTarget size={22} />
        <div>
          <b>+12 keywords</b>
          <small>Auto-matched to role</small>
        </div>
      </motion.div>

      <motion.div
        className="hero-chip hero-chip--check"
        animate={reduce ? undefined : { y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" as const }}
      >
        <FiCheckCircle size={22} />
        <div>
          <b>Parser-safe</b>
          <small>DOCX · PDF · TXT</small>
        </div>
      </motion.div>

      <motion.span
        className="hero-spark hero-spark-1"
        animate={reduce ? undefined : { opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.span
        className="hero-spark hero-spark-2"
        animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 4, delay: 0.8, repeat: Infinity }}
      />
      <motion.span
        className="hero-spark hero-spark-3"
        animate={reduce ? undefined : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 3.5, delay: 1.4, repeat: Infinity }}
      />
    </motion.div>
  );
}

