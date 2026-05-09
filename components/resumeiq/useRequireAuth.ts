"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { bootstrapSession, type PublicUser } from "@/lib/authClient";

export function useRequireAuth() {
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

  return { user, checked };
}
