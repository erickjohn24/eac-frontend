import PDFDocument from "pdfkit";

/** Render a simple multi-section PDF to a Buffer. Local copy of the helper in
 *  @tz/flows — we don't import that package here because it pulls playwright. */
export async function renderPdf(doc: {
  title: string;
  subtitle?: string;
  sections: { heading: string; body: string }[];
  footer?: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    pdf.on("data", (c) => chunks.push(c as Buffer));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.fontSize(20).font("Helvetica-Bold").text(doc.title, { align: "center" });
    if (doc.subtitle) {
      pdf.moveDown(0.3);
      pdf.fontSize(11).font("Helvetica").fillColor("#555").text(doc.subtitle, { align: "center" });
      pdf.fillColor("#000");
    }
    pdf.moveDown(1);

    for (const section of doc.sections) {
      pdf.fontSize(13).font("Helvetica-Bold").text(section.heading);
      pdf.moveDown(0.3);
      pdf.fontSize(10.5).font("Helvetica").text(section.body, { align: "left" });
      pdf.moveDown(0.8);
    }

    if (doc.footer) {
      pdf.moveDown(1);
      pdf.fontSize(8).fillColor("#888").text(doc.footer, { align: "center" });
    }
    pdf.end();
  });
}
