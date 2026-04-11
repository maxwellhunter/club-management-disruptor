import PDFDocument from "pdfkit";
import type { StatementLineItem } from "@club/shared";

export interface StatementPdfData {
  period: string; // "April 2026"
  memberName: string;
  memberEmail: string;
  memberNumber: string | null;
  tierName: string | null;

  clubName: string;
  clubAddress: string | null;
  clubPhone: string | null;
  clubEmail: string | null;

  previousBalance: number;
  duesAmount: number;
  chargesAmount: number;
  assessmentsAmount: number;
  creditsAmount: number;
  totalDue: number;

  lineItems: StatementLineItem[];
}

const GREEN = "#16a34a";
const DARK = "#1a1a1a";
const MUTED = "#6b7280";
const LIGHT_GRAY = "#f3f4f6";
const BORDER = "#e5e7eb";

function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function generateStatementPdf(data: StatementPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Statement — ${data.period}`,
        Author: data.clubName,
        Subject: `Monthly statement for ${data.memberName}`,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 512; // 612 - 50*2

    // === Header ===
    doc.fillColor(GREEN).fontSize(22).font("Helvetica-Bold").text(data.clubName, 50, 50);

    let headerY = 52;
    doc.fillColor(MUTED).fontSize(10).font("Helvetica");
    if (data.clubAddress) { doc.text(data.clubAddress, 50, headerY + 28); headerY += 14; }
    if (data.clubPhone) { doc.text(data.clubPhone, 50, headerY + 28); headerY += 14; }
    if (data.clubEmail) { doc.text(data.clubEmail, 50, headerY + 28); }

    // STATEMENT title
    doc
      .fillColor(DARK).fontSize(28).font("Helvetica-Bold")
      .text("STATEMENT", 50, 50, { align: "right", width: pageWidth });

    doc.fillColor(MUTED).fontSize(10).font("Helvetica")
      .text(`Period: ${data.period}`, 50, 85, { align: "right", width: pageWidth });

    // Divider
    doc.strokeColor(BORDER).lineWidth(1).moveTo(50, 115).lineTo(562, 115).stroke();

    // === Bill To ===
    let y = 130;
    doc.fillColor(MUTED).fontSize(9).font("Helvetica-Bold").text("ACCOUNT HOLDER", 50, y);
    y += 16;
    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(data.memberName, 50, y);
    y += 16;
    doc.fillColor(MUTED).fontSize(9).font("Helvetica").text(data.memberEmail, 50, y);
    if (data.memberNumber) { y += 14; doc.text(`Member #${data.memberNumber}`, 50, y); }
    if (data.tierName) { y += 14; doc.text(`Tier: ${data.tierName}`, 50, y); }

    // === Account Summary Box ===
    y += 30;
    const summaryTop = y;
    doc.rect(50, y, pageWidth, 120).fill(LIGHT_GRAY);

    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text("Account Summary", 66, y + 12);
    y += 32;

    const summaryRows: [string, number][] = [];
    if (data.previousBalance > 0) summaryRows.push(["Previous Balance", data.previousBalance]);
    if (data.duesAmount > 0) summaryRows.push(["Monthly Dues", data.duesAmount]);
    if (data.chargesAmount > 0) summaryRows.push(["Member Charges", data.chargesAmount]);
    if (data.assessmentsAmount > 0) summaryRows.push(["Assessments", data.assessmentsAmount]);
    if (data.creditsAmount > 0) summaryRows.push(["Credits / Payments", -data.creditsAmount]);

    doc.fontSize(9).font("Helvetica");
    for (const [label, amount] of summaryRows) {
      doc.fillColor(MUTED).text(label, 66, y);
      const color = amount < 0 ? GREEN : DARK;
      doc.fillColor(color).text(fmt(amount), 380, y, { align: "right", width: 170 });
      y += 16;
    }

    // Total line
    y += 4;
    doc.strokeColor(BORDER).lineWidth(1).moveTo(66, y).lineTo(546, y).stroke();
    y += 8;
    doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text("Total Due", 66, y);
    const totalColor = data.totalDue > 0 ? "#dc2626" : GREEN;
    doc.fillColor(totalColor).fontSize(12).font("Helvetica-Bold")
      .text(fmt(data.totalDue), 380, y, { align: "right", width: 170 });

    // Resize summary box to fit
    const summaryHeight = y - summaryTop + 24;
    // We already drew a fixed box; for simplicity it works with up to ~5 rows

    // === Activity Detail Table ===
    y = summaryTop + Math.max(summaryHeight, 120) + 20;

    doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text("Activity Detail", 50, y);
    y += 20;

    // Table header
    doc.rect(50, y, pageWidth, 24).fill(LIGHT_GRAY);
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
    doc.text("DATE", 62, y + 8);
    doc.text("DESCRIPTION", 120, y + 8);
    doc.text("AMOUNT", 440, y + 8, { align: "right", width: 110 });
    y += 24;

    // Line items
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    const categoryLabels: Record<string, string> = {
      previous_balance: "BAL",
      dues: "DUES",
      charges: "CHG",
      assessment: "ASM",
      credit: "CR",
      payment: "PMT",
    };

    for (const item of data.lineItems) {
      if (y > 680) {
        doc.addPage();
        y = 50;
      }

      doc.strokeColor(BORDER).lineWidth(0.5).moveTo(50, y).lineTo(562, y).stroke();

      doc.fillColor(MUTED).text(formatDate(item.date), 62, y + 6);

      // Category badge + description
      const badge = categoryLabels[item.category] ?? "";
      doc.fillColor(MUTED).fontSize(7).text(badge, 120, y + 7);
      doc.fillColor(DARK).fontSize(9).text(item.description, 150, y + 6, { width: 280 });

      const color = item.amount < 0 ? GREEN : DARK;
      doc.fillColor(color).text(fmt(item.amount), 440, y + 6, { align: "right", width: 110 });

      y += 24;
    }

    // Bottom border
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(50, y).lineTo(562, y).stroke();

    // === Footer ===
    const footerY = 710;
    doc.strokeColor(BORDER).lineWidth(0.5).moveTo(50, footerY).lineTo(562, footerY).stroke();
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
      .text(
        "This statement reflects your account activity. Payment is due upon receipt unless otherwise noted.",
        50, footerY + 12, { align: "center", width: pageWidth }
      );
    doc.text(
      `Generated by ClubOS on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
      50, footerY + 26, { align: "center", width: pageWidth }
    );

    doc.end();
  });
}
