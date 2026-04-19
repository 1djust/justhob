import PDFDocument from 'pdfkit';

export interface ReceiptData {
  receiptId: string;
  amount: number;
  paidDate: Date;
  tenantName: string;
  propertyName: string;
  unitNumber?: string;
  workspaceName: string;
  note?: string;
}

export const generateReceiptPDF = (data: ReceiptData, stream: NodeJS.WritableStream) => {
  const doc = new PDFDocument({ margin: 50 });

  doc.pipe(stream);

  // Header
  doc
    .fillColor('#4f46e5')
    .fontSize(24)
    .text('EstateOS', { align: 'center' })
    .fontSize(10)
    .fillColor('#64748b')
    .text('Digital Rent Receipt', { align: 'center' })
    .moveDown(2);

  // Receipt Info
  doc
    .fillColor('#0f172a')
    .fontSize(12)
    .text(`Receipt ID: ${data.receiptId}`, { align: 'right' })
    .text(`Date: ${data.paidDate.toLocaleDateString()}`, { align: 'right' })
    .moveDown(1);

  // Divider
  doc
    .strokeColor('#e2e8f0')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(1.5);

  // Content
  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('Payment Details')
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(12);

  const details = [
    ['Tenant', data.tenantName],
    ['Property', data.propertyName],
    ['Unit', data.unitNumber || 'N/A'],
    ['Workspace', data.workspaceName],
    ['Amount Paid', `NGN ${data.amount.toLocaleString()}`],
  ];

  details.forEach(([label, value]) => {
    doc
      .fillColor('#64748b')
      .text(label, { continued: true })
      .fillColor('#0f172a')
      .text(`: ${value}`, { align: 'right' });
    doc.moveDown(0.2);
  });

  if (data.note) {
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#64748b').text('Note:', { continued: true }).fillColor('#0f172a').text(` ${data.note}`);
  }

  // Footer
  doc
    .moveDown(4)
    .fontSize(10)
    .fillColor('#94a3b8')
    .text('Thank you for choosing EstateOS for your property management needs.', { align: 'center' })
    .moveDown(0.5)
    .text('This is a computer-generated receipt and does not require a physical signature.', { align: 'center' });

  doc.end();
};
