"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingState } from "./onboarding-types";

const LS_KEY = "tz-onboarding-draft";
const LS_TOKEN = "tz-onboarding-token";

type SaveState = "idle" | "saving" | "saved";

/**
 * Save & resume: instant localStorage layer plus a debounced server draft
 * keyed by a resume token (?draft=TOKEN restores on any device).
 */
export function useDraft(
  state: OnboardingState,
  restore: (s: OnboardingState) => void,
) {
  const [token, setToken] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hydrated, setHydrated] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const dirty = useRef(false);

  // restore once: URL token wins, then localStorage
  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const urlToken = url.searchParams.get("draft");
      if (urlToken) {
        try {
          const res = await fetch(`/api/drafts?token=${encodeURIComponent(urlToken)}`);
          if (res.ok) {
            const { state: saved } = await res.json();
            restore(saved as OnboardingState);
            setToken(urlToken);
            localStorage.setItem(LS_TOKEN, urlToken);
            setHydrated(true);
            return;
          }
        } catch {
          /* fall through to local */
        }
      }
      const localToken = localStorage.getItem(LS_TOKEN);
      if (localToken) setToken(localToken);
      const local = localStorage.getItem(LS_KEY);
      if (local) {
        try {
          restore(JSON.parse(local) as OnboardingState);
        } catch {
          /* corrupt draft — start fresh */
        }
      }
      setHydrated(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave on change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    dirty.current = true;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    setSaveState("saving");
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const email = state.people.find((p) => p.isPrimaryContact)?.email || undefined;
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token, state, email }),
        });
        const data = await res.json();
        if (data.token && data.token !== token) {
          setToken(data.token);
          localStorage.setItem(LS_TOKEN, data.token);
        }
        setSaveState("saved");
      } catch {
        setSaveState("idle"); // local copy still holds
      }
    }, 1200);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated]);

  const resumeUrl = useCallback(() => {
    if (!token) return null;
    const url = new URL(window.location.href);
    url.searchParams.set("draft", token);
    return url.toString();
  }, [token]);

  const clear = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TOKEN);
  }, []);

  return { saveState, resumeUrl, clear, hydrated };
}
