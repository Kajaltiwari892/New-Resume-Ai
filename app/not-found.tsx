"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSession } from "@/lib/authClient";
import { getOnboarding } from "@/lib/resumeClient";

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await bootstrapSession();
      if (cancelled) return;
      if (!user) {
        router.replace("/auth");
        return;
      }
      try {
        const { profile } = await getOnboarding();
        if (cancelled) return;
        router.replace(profile?.onboardingCompleted ? "/dashboard" : "/onboarding");
      } catch {
        if (!cancelled) router.replace("/dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="app-shell">
      <div className="ambient-grid" />
    </main>
  );
}
