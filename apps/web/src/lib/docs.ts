import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, companies, documents, people, signatureRequests } from "@tz/db";
import { renderPdf } from "@/lib/pdf";
import { getStorage, sha256 } from "@/lib/storage";

type Company = typeof companies.$inferSelect;
type Person = typeof people.$inferSelect;

const tzs = (n: number) => `TZS ${n.toLocaleString("en-US")}`;

function maskNin(nin: string | null): string {
  if (!nin) return "—";
  if (nin.length <= 6) return nin;
  return `${nin.slice(0, 4)}${"*".repeat(nin.length - 6)}${nin.slice(-2)}`;
}

function pct(shares: number, total: number): string {
  if (total <= 0) return "0%";
  const v = (shares / total) * 100;
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

function parValue(company: Company): number {
  return company.totalShares > 0
    ? Math.round(company.shareCapitalTzs / company.totalShares)
    : 0;
}

function subscriberTable(company: Company, shareholders: Person[]): string {
  return shareholders
    .map(
      (p) =>
        `${p.fullName} — ${p.sharesHeld.toLocaleString("en-US")} ordinary shares of ${tzs(
          parValue(company),
        )} each (${pct(p.sharesHeld, company.totalShares)})`,
    )
    .join("\n");
}

const FOOTER = "Prepared by tz-compliance from the founders' answers. Generated document — review before filing.";

function memartsPdf(company: Company, persons: Person[]) {
  const directors = persons.filter((p) => p.roles.includes("director"));
  const shareholders = persons.filter((p) => p.roles.includes("shareholder"));
  const objects = [
    company.activityDescription,
    company.businessActivityIsic.length > 0
      ? `Classified business activities (ISIC): ${company.businessActivityIsic.join(", ")}.`
      : "",
    "To do all such other things as are incidental or conducive to the attainment of the above objects.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return renderPdf({
    title: "Memorandum and Articles of Association",
    subtitle: `${company.name} — a company limited by shares, incorporated under the Companies Act, Cap. 212`,
    sections: [
      { heading: "1. Name", body: `The name of the company is ${company.name}.` },
      {
        heading: "2. Registered office",
        body: `The registered office of the company is situated at ${company.physicalAddress}, ${company.district}, ${company.region}, United Republic of Tanzania.`,
      },
      { heading: "3. Objects", body: `The objects for which the company is established are:\n\n${objects}` },
      {
        heading: "4. Liability of members",
        body: "The liability of the members is limited by shares. Each member's liability is limited to the amount, if any, unpaid on the shares held by them.",
      },
      {
        heading: "5. Share capital",
        body: `The share capital of the company is ${tzs(company.shareCapitalTzs)}, divided into ${company.totalShares.toLocaleString(
          "en-US",
        )} ordinary shares of ${tzs(parValue(company))} each.\n\nWe, the subscribers whose names appear below, wish to be formed into a company pursuant to this memorandum, and we agree to take the number of shares set against our respective names:\n\n${subscriberTable(
          company,
          shareholders,
        )}`,
      },
      {
        heading: "6. Directors",
        body: `The first directors of the company are:\n\n${directors.map((d) => `${d.fullName} — ${d.nationality}`).join("\n")}`,
      },
      {
        heading: "Articles of Association",
        body: "The company adopts the standard articles for a private company limited by shares under the Companies Act, Cap. 212, governing shares and transfers, general meetings, proceedings of directors, dividends, accounts and notices. Decisions of the board are taken by majority; each ordinary share carries one vote.",
      },
    ],
    footer: FOOTER,
  });
}

function declarationPdf(company: Company, firstDirector: Person) {
  return renderPdf({
    title: "Declaration of Compliance",
    subtitle: `${company.name} — Companies Act, Cap. 212 of the Laws of Tanzania`,
    sections: [
      {
        heading: "Declaration",
        body: `I, ${firstDirector.fullName}, of ${company.physicalAddress}, ${company.district}, ${company.region}, being a person named as director in the articles of ${company.name}, solemnly and sincerely declare that all the requirements of the Companies Act, Cap. 212 in respect of the registration of the above-named company, and of matters precedent and incidental thereto, have been complied with.`,
      },
      {
        heading: "Basis",
        body: "I make this solemn declaration conscientiously believing the same to be true, and by virtue of the provisions of the Companies Act, Cap. 212.",
      },
      {
        heading: "Declarant",
        body: `${firstDirector.fullName}\nDirector, ${company.name}\nNationality: ${firstDirector.nationality}`,
      },
    ],
    footer: FOOTER,
  });
}

function boardResolutionPdf(company: Company, persons: Person[]) {
  const directors = persons.filter((p) => p.roles.includes("director"));
  const signatories = persons.filter(
    (p) => p.roles.includes("director") || p.roles.includes("signatory"),
  );
  return renderPdf({
    title: "First Resolutions of the Board of Directors",
    subtitle: company.name,
    sections: [
      {
        heading: "Present",
        body: directors.map((d) => `${d.fullName} — Director`).join("\n"),
      },
      {
        heading: "1. Certificate of incorporation",
        body: `RESOLVED that the certificate of incorporation issued by the Registrar of Companies in respect of ${company.name} be and is hereby accepted, and that the company commence business.`,
      },
      {
        heading: "2. Bank account",
        body: `RESOLVED that a bank account be opened in the name of the company with a licensed bank in the United Republic of Tanzania, and that the following persons be authorised as signatories to the account:\n\n${signatories
          .map((s) => `${s.fullName}`)
          .join("\n")}`,
      },
      {
        heading: "3. Registered office",
        body: `RESOLVED that the registered office of the company be situated at ${company.physicalAddress}, ${company.district}, ${company.region}.`,
      },
    ],
    footer: FOOTER,
  });
}

function beneficialOwnershipPdf(company: Company, shareholders: Person[]) {
  return renderPdf({
    title: "Beneficial Ownership Declaration",
    subtitle: `${company.name} — register of beneficial owners`,
    sections: [
      {
        heading: "Declaration",
        body: `The persons listed below are the beneficial owners of ${company.name}, holding the shares and voting rights set against their names. This declaration is made for the purposes of the beneficial ownership requirements under the Companies Act, Cap. 212.`,
      },
      {
        heading: "Beneficial owners",
        body: shareholders
          .map(
            (p) =>
              `${p.fullName} — ${pct(p.sharesHeld, company.totalShares)} (${p.sharesHeld.toLocaleString(
                "en-US",
              )} of ${company.totalShares.toLocaleString("en-US")} shares) · Nationality: ${p.nationality} · NIN: ${maskNin(p.nin)}`,
          )
          .join("\n"),
      },
      {
        heading: "Confirmation",
        body: "Each beneficial owner confirms the accuracy of the particulars set against their name and undertakes to notify the company of any change within 30 days.",
      },
    ],
    footer: FOOTER,
  });
}

function shareSubscriptionPdf(company: Company, shareholder: Person) {
  return renderPdf({
    title: "Share Subscription",
    subtitle: `${company.name} — subscription by ${shareholder.fullName}`,
    sections: [
      {
        heading: "Subscription",
        body: `I, ${shareholder.fullName}, hereby subscribe for ${shareholder.sharesHeld.toLocaleString(
          "en-US",
        )} ordinary shares of ${tzs(parValue(company))} each in the capital of ${company.name}, representing ${pct(
          shareholder.sharesHeld,
          company.totalShares,
        )} of the issued share capital of ${tzs(company.shareCapitalTzs)}.`,
      },
      {
        heading: "Agreement",
        body: "I agree to take the shares set out above subject to the memorandum and articles of association of the company, and to pay for them in full when called upon by the directors.",
      },
      {
        heading: "Subscriber",
        body: `${shareholder.fullName}\nNationality: ${shareholder.nationality}`,
      },
    ],
    footer: FOOTER,
  });
}

/** Generate the incorporation document set for a company, store the PDFs and
 *  create one signature request per required signer. Safe to re-run: existing
 *  (document, person) signature requests are kept, not duplicated. */
export async function generateCompanyDocuments(
  companyId: string,
): Promise<{ documents: number; signatures: number }> {
  const db = getDb();
  const storage = getStorage();

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
  if (!company) throw new Error(`Company ${companyId} not found`);
  const persons = await db.select().from(people).where(eq(people.companyId, companyId));

  const directors = persons.filter((p) => p.roles.includes("director"));
  const shareholders = persons.filter((p) => p.roles.includes("shareholder"));
  const firstDirector = directors[0] ?? persons[0];
  if (!firstDirector) throw new Error(`Company ${companyId} has no people`);

  /** Render + store one document, insert its row, return the document id. */
  async function saveDoc(kind: string, title: string, pdf: Buffer): Promise<string> {
    const docId = randomUUID();
    const storageKey = `documents/${companyId}/${docId}.pdf`;
    await storage.put(storageKey, pdf, "application/pdf");
    await db.insert(documents).values({
      id: docId,
      companyId,
      kind,
      title,
      storageKey,
      mimeType: "application/pdf",
      sizeBytes: pdf.length,
      sha256: sha256(pdf),
      source: "generated",
    });
    return docId;
  }

  const memartsId = await saveDoc(
    "memarts",
    "Memorandum & Articles of Association",
    await memartsPdf(company, persons),
  );
  const declarationId = await saveDoc(
    "declaration_of_compliance",
    "Declaration of compliance",
    await declarationPdf(company, firstDirector),
  );
  const resolutionId = await saveDoc(
    "board_resolution",
    "First board resolution",
    await boardResolutionPdf(company, persons),
  );
  const beneficialId = await saveDoc(
    "other",
    "Beneficial ownership declaration",
    await beneficialOwnershipPdf(company, shareholders),
  );

  const subscriptionIds = new Map<string, string>();
  for (const sh of shareholders) {
    const docId = await saveDoc(
      "other",
      `Share subscription — ${sh.fullName}`,
      await shareSubscriptionPdf(company, sh),
    );
    subscriptionIds.set(sh.id, docId);
  }

  const documentCount = 4 + subscriptionIds.size;

  // every director signs the core set; each shareholder signs their own subscription
  const wanted: { documentId: string; personId: string }[] = [];
  for (const d of directors) {
    for (const documentId of [memartsId, declarationId, resolutionId, beneficialId]) {
      wanted.push({ documentId, personId: d.id });
    }
  }
  for (const sh of shareholders) {
    const documentId = subscriptionIds.get(sh.id);
    if (documentId) wanted.push({ documentId, personId: sh.id });
  }

  let signatures = 0;
  for (const w of wanted) {
    const [existing] = await db
      .select({ id: signatureRequests.id })
      .from(signatureRequests)
      .where(
        and(
          eq(signatureRequests.documentId, w.documentId),
          eq(signatureRequests.personId, w.personId),
        ),
      );
    if (existing) continue;
    await db.insert(signatureRequests).values({
      documentId: w.documentId,
      companyId,
      personId: w.personId,
      token: randomBytes(16).toString("base64url"),
      status: "pending",
    });
    signatures += 1;
  }

  return { documents: documentCount, signatures };
}
