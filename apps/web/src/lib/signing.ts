import { eq } from "drizzle-orm";
import { getDb, companies, documents, people, signatureRequests } from "@tz/db";

export interface SigningContext {
  requestId: string;
  status: string;
  signedAt: Date | null;
  document: { id: string; title: string; kind: string; url: string };
  signer: { id: string; fullName: string; roles: string[] };
  company: { id: string; name: string; status: string };
  /** every signature request for the company, for the tracker */
  others: { fullName: string; personId: string; docTitle: string; status: string }[];
}

/** Load everything the signing room needs from a signing token. */
export async function loadSigningContext(token: string): Promise<SigningContext | null> {
  const db = getDb();
  const [row] = await db
    .select({
      requestId: signatureRequests.id,
      status: signatureRequests.status,
      signedAt: signatureRequests.signedAt,
      docId: documents.id,
      docTitle: documents.title,
      docKind: documents.kind,
      storageKey: documents.storageKey,
      personId: people.id,
      fullName: people.fullName,
      roles: people.roles,
      companyId: companies.id,
      companyName: companies.name,
      companyStatus: companies.status,
    })
    .from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .innerJoin(people, eq(signatureRequests.personId, people.id))
    .innerJoin(companies, eq(signatureRequests.companyId, companies.id))
    .where(eq(signatureRequests.token, token));

  if (!row) return null;

  const others = await db
    .select({
      fullName: people.fullName,
      personId: people.id,
      docTitle: documents.title,
      status: signatureRequests.status,
    })
    .from(signatureRequests)
    .innerJoin(documents, eq(signatureRequests.documentId, documents.id))
    .innerJoin(people, eq(signatureRequests.personId, people.id))
    .where(eq(signatureRequests.companyId, row.companyId))
    .orderBy(people.fullName, documents.title);

  return {
    requestId: row.requestId,
    status: row.status,
    signedAt: row.signedAt,
    document: {
      id: row.docId,
      title: row.docTitle,
      kind: row.docKind,
      url: `/api/artifacts/${row.storageKey}`,
    },
    signer: { id: row.personId, fullName: row.fullName, roles: row.roles },
    company: { id: row.companyId, name: row.companyName, status: row.companyStatus },
    others,
  };
}
