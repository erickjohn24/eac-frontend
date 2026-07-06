import type { Flow, FlowResult } from "@tz/agent-core";
import { BANKS, formatTzs } from "@tz/shared";
import { renderPdf } from "../pdf.js";

/**
 * Corporate bank account — a concierge step. Bank onboarding is branch-based,
 * so we generate the complete document pack the bank needs, then raise an
 * appointment action item. The signatories attend once and the account opens.
 */
export const bankAccountConcierge: Flow = async (ctx): Promise<FlowResult> => {
  const company = await ctx.repo.getCompany(ctx.companyId);
  const people = await ctx.repo.getPeople(ctx.companyId);
  const signatories = people.filter(
    (p) => p.roles.includes("signatory") || p.roles.includes("director"),
  );
  const bank = BANKS[0];

  const pack = await renderPdf({
    title: "Corporate Bank Account — Document Pack",
    subtitle: `${company.name} — prepared for ${bank.name}`,
    sections: [
      {
        heading: "Account opening checklist",
        body: [
          "☑ Certificate of Incorporation",
          "☑ Memorandum & Articles of Association",
          "☑ Board resolution to open the account",
          `☑ Company TIN: ${company.tin ?? "—"}`,
          "☑ Business licence",
          "☑ Signatory identification (NIDA/passport) + 2 passport photos each",
          `☑ Minimum opening balance: ${formatTzs(bank.minOpeningTzs)}`,
        ].join("\n"),
      },
      {
        heading: "Authorized signatories",
        body: signatories.map((s) => `  • ${s.fullName}`).join("\n") || "  • (none on file)",
      },
      {
        heading: "Recommended bank",
        body: `${bank.name} — ${bank.account}. Minimum opening balance ${formatTzs(bank.minOpeningTzs)}.`,
      },
    ],
    footer: "Bring this pack and the listed originals to your branch appointment.",
  });

  const packDoc = await ctx.repo.addDocument({
    companyId: ctx.companyId,
    stepRunId: ctx.stepRunId,
    kind: "bank_pack",
    title: `Bank Account Document Pack — ${company.name}`,
    data: pack,
    source: "generated",
  });

  await ctx.actions.record({
    kind: "extract",
    detail: `Generated bank document pack for ${bank.name}`,
  });

  await ctx.hitl.require({
    key: "bank.appointment",
    type: "appointment",
    title: `Open your ${bank.name} account`,
    instructionsMd:
      `Your corporate bank account pack is ready. We've booked a branch appointment with **${bank.name}**.\n\n` +
      `Bring the document pack (in your Documents vault) and the original certificate, Memarts, board resolution, TIN and licence, plus each signatory's ID and two passport photos. Minimum opening balance is ${formatTzs(bank.minOpeningTzs)}.\n\n` +
      `Tap "Done" once the account is open and enter the account number.`,
    payload: { documentKind: "bank_pack" },
    expiresInMinutes: 60 * 24 * 7,
  });

  return { output: { bankPackDocumentId: packDoc.id, bank: bank.name } };
};
