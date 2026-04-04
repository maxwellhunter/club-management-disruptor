import { generateInvoicePdf, InvoicePdfData } from "../invoice-pdf";

function makeInvoiceData(overrides?: Partial<InvoicePdfData>): InvoicePdfData {
  return {
    invoiceId: "00000000-0000-0000-0000-000000000001",
    invoiceNumber: "INV-00000000",
    status: "sent",
    description: "Monthly Dues — Gold Tier (January 2026)",
    amount: 750,
    dueDate: "2026-01-31",
    createdAt: "2026-01-01T00:00:00Z",
    paidAt: null,
    memberName: "James Wilson",
    memberEmail: "james@greenfieldcc.com",
    memberNumber: "1042",
    clubName: "Greenfield Country Club",
    clubAddress: "123 Fairway Dr, Greenwich, CT 06830",
    clubPhone: "(203) 555-0100",
    clubEmail: "billing@greenfieldcc.com",
    ...overrides,
  };
}

describe("generateInvoicePdf", () => {
  it("returns a valid PDF buffer", async () => {
    const buffer = await generateInvoicePdf(makeInvoiceData());

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    // PDF files start with %PDF-
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF for a paid invoice", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({
        status: "paid",
        paidAt: "2026-01-15T14:30:00Z",
      })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF for a draft invoice", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({ status: "draft" })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF for an overdue invoice", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({ status: "overdue" })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF with minimal club info", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({
        clubAddress: null,
        clubPhone: null,
        clubEmail: null,
        memberNumber: null,
      })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF with multiple line items", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({
        amount: 1250,
        lineItems: [
          { description: "Monthly Dues — Gold Tier", amount: 750 },
          { description: "Dining Minimum Shortfall", amount: 200 },
          { description: "Capital Assessment (Installment 3/12)", amount: 300 },
        ],
      })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Multi-line-item PDFs should be larger than single-item ones
    const singleItemBuffer = await generateInvoicePdf(makeInvoiceData());
    expect(buffer.length).toBeGreaterThan(singleItemBuffer.length);
  });

  it("generates PDF with void status", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({ status: "void" })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates PDF with cancelled status", async () => {
    const buffer = await generateInvoicePdf(
      makeInvoiceData({ status: "cancelled" })
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("includes invoice metadata in PDF info", async () => {
    const buffer = await generateInvoicePdf(makeInvoiceData());
    const pdfString = buffer.toString("latin1");

    // PDFKit embeds the Title and Author in the PDF metadata
    expect(pdfString).toContain("INV-00000000");
    expect(pdfString).toContain("Greenfield Country Club");
  });

  it("generates deterministic output for same input", async () => {
    const data = makeInvoiceData();
    const buffer1 = await generateInvoicePdf(data);
    const buffer2 = await generateInvoicePdf(data);

    // PDFs contain creation timestamps so they won't be byte-identical,
    // but they should be the same size
    expect(buffer1.length).toBe(buffer2.length);
  });
});
