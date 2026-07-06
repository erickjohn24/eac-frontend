"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { AnimatedCheck } from "@/components/ui/animated-check";

const normalize = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** The act of signing: type your legal name, confirm intent, sign. */
export function SignPanel({
  token,
  fullName,
  alreadySigned,
}: {
  token: string;
  fullName: string;
  alreadySigned: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(alreadySigned);

  const firstName = fullName.split(" ")[0];
  const nameMatches = normalize(name) === normalize(fullName);
  const ready = nameMatches && consent && !submitting;

  async function sign() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureText: name.trim(), consent: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong on our side. Try again.");
      }
      setSigned(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong on our side. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {signed ? (
          <motion.div
            key="signed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center px-6 py-10 text-center sm:px-8"
          >
            <div className="grid size-14 place-items-center rounded-full bg-success/12 text-success ring-1 ring-success/25">
              <AnimatedCheck size={30} delay={0.15} />
            </div>
            <h2 className="mt-5 text-title">Signed</h2>
            <p className="mt-2 max-w-sm text-[0.92rem] leading-relaxed text-fg-muted">
              We&apos;ll start filing the moment everyone has signed. Nothing else is
              needed from you on this document.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-6 sm:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-tz-500/15 text-tz-300">
                <PenLine className="size-4.5" />
              </div>
              <div>
                <h2 className="text-section">Sign as {fullName}</h2>
                <p className="text-caption">
                  Typing your name here carries the same legal weight as ink.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <Field
                label="Type your full legal name"
                hint={
                  name && !nameMatches
                    ? `Your name needs to match exactly: ${fullName}`
                    : undefined
                }
              >
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={fullName}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-display text-[1.15rem] italic tracking-wide"
                />
              </Field>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-auto rounded border-hairline accent-[#7c6bf5]"
              />
              <span className="text-[0.85rem] leading-relaxed text-fg-muted">
                I intend this typed name to be my legal signature on this document.
              </span>
            </label>

            {error && <p className="mt-4 text-[0.82rem] text-danger">{error}</p>}

            <Button className="mt-6 w-full" disabled={!ready} onClick={sign}>
              {submitting ? "Signing…" : `Sign as ${firstName}`}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
