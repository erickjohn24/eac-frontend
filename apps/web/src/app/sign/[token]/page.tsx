import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";
import { loadSigningContext } from "@/lib/signing";
import { SignPanel } from "@/components/signing/sign-panel";
import { SigningTracker } from "@/components/signing/signing-tracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign your company documents — tz-compliance",
};

/** One or two plain-language sentences on what the signer is looking at:
 *  definition → consequence → the norm → we handle it. */
function explain(kind: string, title: string): string {
  if (kind === "memarts") {
    return "The Memorandum & Articles are your company's rulebook — what it does and how decisions get made. BRELA requires them at filing. We prepared these from your answers; most companies never customize them.";
  }
  if (kind === "declaration_of_compliance") {
    return "The declaration of compliance confirms the registration requirements of the Companies Act (Cap. 212) have been met. This means a director takes responsibility for the accuracy of the filing — BRELA won't register a company without it. We prepared it from your answers; you just sign.";
  }
  if (kind === "board_resolution") {
    return "The first board resolution is the directors' formal go-ahead — accepting the certificate, opening the bank account and confirming the registered office. This means the company can act from day one. Every new company passes one; we've drafted yours already.";
  }
  const t = title.toLowerCase();
  if (t.startsWith("beneficial ownership")) {
    return "The beneficial ownership declaration tells BRELA who ultimately owns the company. This means every shareholder is on the register with their exact stake — it's required at filing. We filled it in from your cap table.";
  }
  if (t.startsWith("share subscription")) {
    return "A share subscription is your written agreement to take your shares. This means your stake exists on paper, not just in conversation. Every shareholder signs one; we prepared yours from the cap table.";
  }
  return "We prepared this document from your answers. Review it below, then sign.";
}

function InvalidLink() {
  return (
    <div className="relative grid min-h-dvh place-items-center px-5">
      <div className="backdrop" />
      <div className="relative z-10 max-w-md text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-hairline bg-panel-2 text-fg-faint">
          <FileQuestion className="size-6" />
        </div>
        <h1 className="mt-6 text-title">This signing link isn&apos;t valid anymore</h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-fg-muted">
          It may have been replaced with a newer one. Ask the person who&apos;s setting
          up the company to resend your link — signing takes under a minute.
        </p>
      </div>
    </div>
  );
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const ctx = await loadSigningContext(token);
  if (!ctx) return <InvalidLink />;

  return (
    <div className="relative min-h-dvh">
      <div className="backdrop" />
      <main className="relative z-10 mx-auto w-full max-w-[720px] px-5 pb-20 pt-14 sm:pt-20">
        <header>
          <p className="text-eyebrow">Signature requested</p>
          <h1 className="mt-3 text-display">{ctx.document.title}</h1>
          <p className="mt-3 text-[0.85rem] text-fg-faint">
            For <span className="text-fg-muted">{ctx.company.name}</span> · requested of{" "}
            <span className="text-fg-muted">{ctx.signer.fullName}</span>
          </p>
          <p className="mt-5 max-w-[60ch] text-[0.95rem] leading-relaxed text-fg-muted">
            {explain(ctx.document.kind, ctx.document.title)}
          </p>
        </header>

        <div className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-white shadow-[var(--shadow-soft)]">
          <iframe
            src={`${ctx.document.url}#toolbar=0&navpanes=0&view=FitH`}
            title={ctx.document.title}
            className="block h-[560px] w-full bg-white"
          />
        </div>

        <div className="mt-6">
          <SignPanel
            token={token}
            fullName={ctx.signer.fullName}
            alreadySigned={ctx.status === "signed"}
          />
        </div>

        <div className="mt-6">
          <SigningTracker requests={ctx.others} youPersonId={ctx.signer.id} />
        </div>

        <p className="mt-10 text-center text-caption">
          Questions about what you&apos;re signing? Reply to the email that brought you
          here — a real person reads it.
        </p>
      </main>
    </div>
  );
}
