import PDFDocument from "pdfkit";
import type { Response } from "express";

export interface CertificateOpts {
  portal: string;
  title: string;
  entityName: string;
  number: string;
  date: string;
}

/** Stream a simple but real PDF certificate to the response. */
export function generateCertificate(res: Response, opts: CertificateOpts): void {
  const { portal, title, entityName, number, date } = opts;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${number.replace(/[^\w.-]/g, "_")}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 56 });
  doc.pipe(res);

  doc.fontSize(10).fillColor("#555").text("UNITED REPUBLIC OF TANZANIA", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(16).fillColor("#111").text(portal, { align: "center" });
  doc.moveDown(0.2);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#888")
    .stroke();
  doc.moveDown(1.5);

  doc.fontSize(20).fillColor("#0a3d62").text(title, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(12).fillColor("#333").text("This is to certify that", { align: "center" });
  doc.moveDown(0.6);
  doc.fontSize(18).fillColor("#111").text(entityName, { align: "center" });
  doc.moveDown(2);

  doc.fontSize(12).fillColor("#333");
  doc.text(`Reference / Number:  ${number}`, { align: "center" });
  doc.moveDown(0.4);
  doc.text(`Date of issue:  ${date}`, { align: "center" });
  doc.moveDown(2.5);

  // QR-ish box containing the number
  const boxW = 120;
  const boxX = (doc.page.width - boxW) / 2;
  const boxY = doc.y;
  doc.rect(boxX, boxY, boxW, boxW).strokeColor("#111").lineWidth(2).stroke();
  doc
    .fontSize(9)
    .fillColor("#111")
    .text(number, boxX, boxY + boxW / 2 - 6, { width: boxW, align: "center" });

  doc.fontSize(8).fillColor("#777");
  doc.text(
    "Portal Simulator — sandbox document, not a valid government certificate.",
    doc.page.margins.left,
    doc.page.height - doc.page.margins.bottom - 20,
    { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right },
  );

  doc.end();
}
