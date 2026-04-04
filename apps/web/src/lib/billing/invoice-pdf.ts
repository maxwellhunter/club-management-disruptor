import PDFDocument from "pdfkit";

export interface InvoicePdfData {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  description: string;
  amount: number;
  dueDate: string;
  createdAt: string;
  paidAt: string | null;

  memberName: string;
  memberEmail: string;
  memberNumber: string | null;

  clubName: string;
  clubAddress: string | null;
  clubPhone: string | null;
  clubEmail: string | null;

  lineItems?: { description: string; amount: number }[];
}

const GREEN = "#16a34a";
const DARK = "#1a1a1a";
const MUTED = "#6b7280";
const LIGHT_GRAY = "#f3f4f6";
const BORDER = "#e5e7eb";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Invoice ${data.invoiceNumber}`,
        Author: data.clubName,
        Subject: `Invoice for ${data.memberName}`,
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 512; // 612 - 50 - 50

    // === Header: Club name + INVOICE label ===
    doc
      .fillColor(GREEN)
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(data.clubName, 50, 50);

    doc
      .fillColor(MUTED)
      .fontSize(10)
      .font("Helvetica");

    let headerY = 52;
    if (data.clubAddress) {
      doc.text(data.clubAddress, 50, headerY + 28);
      headerY += 14;
    }
    if (data.clubPhone) {
      doc.text(data.clubPhone, 50, headerY + 28);
      headerY += 14;
    }
    if (data.clubEmail) {
      doc.text(data.clubEmail, 50, headerY + 28);
    }

    // INVOICE title — right aligned
    doc
      .fillColor(DARK)
      .fontSize(28)
      .font("Helvetica-Bold")
      .text("INVOICE", 50, 50, { align: "right", width: pageWidth });

    // Invoice number and dates — right aligned
    const rightColX = 380;
    let rightY = 85;

    doc.fontSize(9).font("Helvetica").fillColor(MUTED);
    doc.text("Invoice #", rightColX, rightY);
    doc
      .font("Helvetica-Bold")
      .fillColor(DARK)
      .text(data.invoiceNumber, rightColX + 70, rightY);

    rightY += 16;
    doc.font("Helvetica").fillColor(MUTED);
    doc.text("Date", rightColX, rightY);
    doc
      .font("Helvetica")
      .fillColor(DARK)
      .text(formatDate(data.createdAt), rightColX + 70, rightY);

    rightY += 16;
    doc.font("Helvetica").fillColor(MUTED);
    doc.text("Due Date", rightColX, rightY);
    doc
      .font("Helvetica")
      .fillColor(DARK)
      .text(formatDate(data.dueDate), rightColX + 70, rightY);

    rightY += 16;
    doc.font("Helvetica").fillColor(MUTED);
    doc.text("Status", rightColX, rightY);

    const statusColors: Record<string, string> = {
      paid: "#16a34a",
      sent: "#2563eb",
      overdue: "#dc2626",
      draft: "#6b7280",
      void: "#6b7280",
      cancelled: "#6b7280",
    };
    doc
      .font("Helvetica-Bold")
      .fillColor(statusColors[data.status] || MUTED)
      .text(data.status.toUpperCase(), rightColX + 70, rightY);

    // === Divider ===
    const dividerY = 155;
    doc
      .strokeColor(BORDER)
      .lineWidth(1)
      .moveTo(50, dividerY)
      .lineTo(562, dividerY)
      .stroke();

    // === Bill To ===
    let billToY = dividerY + 20;

    doc
      .fillColor(MUTED)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("BILL TO", 50, billToY);

    billToY += 16;
    doc
      .fillColor(DARK)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(data.memberName, 50, billToY);

    billToY += 16;
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .font("Helvetica")
      .text(data.memberEmail, 50, billToY);

    if (data.memberNumber) {
      billToY += 14;
      doc.text(`Member #${data.memberNumber}`, 50, billToY);
    }

    // === Line Items Table ===
    let tableY = billToY + 35;

    // Table header background
    doc.rect(50, tableY, pageWidth, 28).fill(LIGHT_GRAY);

    // Table header text
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font("Helvetica-Bold");
    doc.text("DESCRIPTION", 62, tableY + 9);
    doc.text("AMOUNT", 440, tableY + 9, {
      align: "right",
      width: 110,
    });

    tableY += 28;

    // Line items
    const items =
      data.lineItems && data.lineItems.length > 0
        ? data.lineItems
        : [{ description: data.description, amount: data.amount }];

    doc.font("Helvetica").fontSize(10).fillColor(DARK);

    for (const item of items) {
      // Row border
      doc
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .moveTo(50, tableY)
        .lineTo(562, tableY)
        .stroke();

      doc
        .fillColor(DARK)
        .font("Helvetica")
        .text(item.description, 62, tableY + 10, { width: 360 });

      doc
        .font("Helvetica")
        .text(formatCurrency(item.amount), 440, tableY + 10, {
          align: "right",
          width: 110,
        });

      tableY += 34;
    }

    // Bottom border of table
    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .moveTo(50, tableY)
      .lineTo(562, tableY)
      .stroke();

    // === Total ===
    tableY += 12;

    // Total background
    doc.rect(380, tableY, 182, 34).fill(GREEN);

    doc
      .fillColor("#ffffff")
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("TOTAL", 392, tableY + 11);

    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(formatCurrency(data.amount), 440, tableY + 10, {
        align: "right",
        width: 110,
      });

    // === Paid stamp ===
    if (data.status === "paid" && data.paidAt) {
      tableY += 50;
      doc
        .fillColor("#16a34a")
        .fontSize(9)
        .font("Helvetica")
        .text(`Paid on ${formatDate(data.paidAt)}`, 380, tableY, {
          align: "right",
          width: 182,
        });
    }

    // === Footer ===
    const footerY = 710;
    doc
      .strokeColor(BORDER)
      .lineWidth(0.5)
      .moveTo(50, footerY)
      .lineTo(562, footerY)
      .stroke();

    doc
      .fillColor(MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text(
        "Thank you for your membership. Questions? Contact the front desk.",
        50,
        footerY + 12,
        { align: "center", width: pageWidth }
      );

    doc.text(
      `Generated by ClubOS on ${formatDate(new Date().toISOString())}`,
      50,
      footerY + 26,
      { align: "center", width: pageWidth }
    );

    doc.end();
  });
}
