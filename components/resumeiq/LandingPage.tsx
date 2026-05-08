"use client";
import Link from "next/link";
import { motion } from "motion/react";
import dynamic from "next/dynamic";

const DarkVeil = dynamic(() => import("@/components/DarkVeil"), { ssr: false });

export default function LandingPage() {
  return (
    <main className="lp-shell">
      {/* ── DarkVeil covers the ENTIRE page including nav ── */}
      <div className="lp-darkveil-bg" aria-hidden>
        <DarkVeil
          hueShift={0}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={0.5}
          scanlineFrequency={0}
          warpAmount={0}
          resolutionScale={1}
        />
      </div>

      {/* ── Glass Navbar (floats over DarkVeil) ── */}
      <header className="lp-nav-wrap" aria-label="Main navigation">
        <nav className="lp-nav lp-nav-glass">
          <Link className="lp-brand" href="/">
            <span className="lp-brand-icon" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </span>
            ResumeIQ
          </Link>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          <div className="lp-nav-right">
            <Link href="/auth" className="lp-nav-signin">Sign in</Link>
            <Link href="/auth" className="lp-nav-get-started">Get started</Link>
          </div>
        </nav>
      </header>

      {/* ── Hero (full-page height, sits under nav) ── */}
      <section className="lp-hero" aria-label="Hero">
        {/* Subtle glow blobs complement the shader */}
        <div className="lp-blob lp-blob-1" aria-hidden />
        <div className="lp-blob lp-blob-2" aria-hidden />

        <div className="lp-hero-content">
          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lp-title"
          >
            Your Resume,
            <br />
            <span className="lp-title-grad">Reimagined by AI</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="lp-subtitle"
          >
            Upload once. Get your ATS score, tailored improvements,
            <br className="lp-br-hide" />
            and interview prep — all in one intelligent workspace.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.42, type: "spring", stiffness: 130, damping: 16 }}
            className="lp-cta-row"
          >
            <Link href="/auth" className="lp-cta-primary">
              Analyze My Resume
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link href="/auth" className="lp-cta-ghost">Sign in</Link>
          </motion.div>

          {/* Trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.62 }}
            className="lp-trust"
          >
            <div className="lp-avatars" aria-hidden>
              {["#7c3aed", "#06b6d4", "#f472b6", "#10b981"].map((c, i) => (
                <span key={i} style={{ background: c }} />
              ))}
            </div>
            <p>
              <strong>10,000+</strong> resumes analyzed &nbsp;·&nbsp; <strong>94%</strong> interview rate
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── DevStudio-style Footer ── */}
      <footer className="lp-footer-v2">
        {/* Top links grid */}
        <div className="lp-footer-top">
          {/* Brand + copyright */}
          <div className="lp-footer-brand-col">
            <Link className="lp-brand" href="/" style={{ marginBottom: "0.75rem" }}>
              <span className="lp-brand-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </span>
              ResumeIQ
            </Link>
            <p className="lp-footer-copy">© copyright ResumeIQ 2026.<br />All rights reserved.</p>
          </div>

          {/* Pages */}
          <div className="lp-footer-col">
            <h4>Pages</h4>
            <Link href="#">Dashboard</Link>
            <Link href="/auth">Sign Up</Link>
            <Link href="/auth">Login</Link>
            <Link href="#">Privacy</Link>
          </div>

          {/* Features */}
          <div className="lp-footer-col">
            <h4>Features</h4>
            <Link href="#">ATS Score</Link>
            <Link href="#">Resume Improver</Link>
            <Link href="#">Interview Prep</Link>
            <Link href="#">Job Match</Link>
          </div>

          {/* Legal */}
          <div className="lp-footer-col">
            <h4>Legal</h4>
            <Link href="#">Privacy Policy</Link>
            <Link href="#">Terms of Service</Link>
            <Link href="#">Cookie Policy</Link>
          </div>

          {/* Account */}
          <div className="lp-footer-col">
            <h4>Account</h4>
            <Link href="/auth">Sign Up</Link>
            <Link href="/auth">Log In</Link>
            <Link href="#">Forgot Password</Link>
          </div>
        </div>

        {/* Big brand watermark */}
        <div className="lp-footer-wordmark" aria-hidden>
          ResumeIQ
        </div>
      </footer>
    </main>
  );
}
