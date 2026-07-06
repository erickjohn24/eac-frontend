import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  type Db,
  companies,
  documents,
  fulfillmentOrders,
  payments,
  people,
} from "@tz/db";
import {
  LocalStorage,
  sha256,
  type CompanyRecord,
  type FlowRepo,
  type PersonRecord,
} from "@tz/agent-core";

/** FlowRepo implementation backed by Postgres + local storage. Documents are
 *  stored at documents/<companyId>/<documentId>.pdf so flows can re-read them. */
export function createRepo(db: Db, storage: LocalStorage): FlowRepo {
  return {
    async getCompany(companyId) {
      const [row] = await db.select().from(companies).where(eq(companies.id, companyId));
      if (!row) throw new Error(`Company ${companyId} not found`);
      return row as unknown as CompanyRecord;
    },

    async updateCompany(companyId, patch) {
      await db
        .update(companies)
        .set({ ...(patch as Record<string, unknown>), updatedAt: new Date() })
        .where(eq(companies.id, companyId));
    },

    async getPeople(companyId) {
      const rows = await db.select().from(people).where(eq(people.companyId, companyId));
      return rows as unknown as PersonRecord[];
    },

    async addDocument(doc) {
      const id = randomUUID();
      const storageKey = `documents/${doc.companyId}/${id}.pdf`;
      await storage.put(storageKey, doc.data, doc.mimeType ?? "application/pdf");
      await db.insert(documents).values({
        id,
        companyId: doc.companyId,
        stepRunId: doc.stepRunId,
        kind: doc.kind,
        title: doc.title,
        storageKey,
        mimeType: doc.mimeType ?? "application/pdf",
        sizeBytes: doc.data.length,
        sha256: sha256(doc.data),
        source: doc.source ?? "generated",
        expiresAt: doc.expiresAt ?? null,
      });
      return { id, storageKey };
    },

    async createPayment(p) {
      const id = randomUUID();
      await db
        .insert(payments)
        .values({
          id,
          companyId: p.companyId,
          stepRunId: p.stepRunId,
          gepgControlNumber: p.gepgControlNumber,
          description: p.description,
          amountTzs: p.amountTzs,
          payee: p.payee,
          status: "awaiting_payer",
        })
        .onConflictDoNothing();
      return { id };
    },

    async markPaymentPaid(gepgControlNumber, method) {
      await db
        .update(payments)
        .set({ status: "paid", method, paidAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.gepgControlNumber, gepgControlNumber));
    },

    async createFulfillmentOrder(o) {
      const id = randomUUID();
      await db.insert(fulfillmentOrders).values({
        id,
        companyId: o.companyId,
        stepRunId: o.stepRunId,
        kind: o.kind,
        vendorId: o.vendorId,
        vendorName: o.vendorName,
        priceTzs: o.priceTzs,
        status: "ordered",
      });
      return { id };
    },
  };
}

export { and, eq };
