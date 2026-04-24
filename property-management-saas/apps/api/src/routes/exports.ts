import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../lib/database';
import { authenticate, verifyWorkspaceAccess, requireManager } from '../lib/middleware';
import PDFDocument from 'pdfkit';

/**
 * Convert an array of objects to a CSV string.
 */
function toCSV(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      // Replace newlines, carriage returns, and tabs with a space to prevent CSV breakage
      const str = String(val)
        .replace(/[\n\r\t]+/g, ' ')
        .replace(/"/g, '""')
        .trim();
      return `"${str}"`;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}

/**
 * Generate a PDF document from rows and columns.
 */
function toPDF(reply: FastifyReply, title: string, rows: Record<string, any>[], columns: { key: string; label: string }[]) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: any[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const result = Buffer.concat(chunks);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename=${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`)
        .send(result);
      resolve();
    });

    // Header
    doc.fontSize(20).text('Just Hub - Property Management', { align: 'center' });
  doc.fontSize(10).text('Enterprise Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(16).text(title, { underline: true });
  doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`);
  doc.moveDown();

  // Simple Table Implementation
  const startX = 50;
  let currentY = doc.y;
  const colWidth = (doc.page.width - 100) / columns.length;

  // Table Header
  doc.fontSize(9).fillColor('#444444');
  columns.forEach((col, i) => {
    doc.text(col.label, startX + i * colWidth, currentY, { width: colWidth, align: 'left' });
  });

  doc.moveTo(startX, currentY + 12).lineTo(doc.page.width - 50, currentY + 12).stroke();
  currentY += 20;

  // Table Rows
  doc.fontSize(8).fillColor('#000000');
  rows.forEach((row) => {
    // Page break if needed
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 50;
    }

    columns.forEach((col, i) => {
      const val = row[col.key];
      doc.text(String(val || ''), startX + i * colWidth, currentY, { width: colWidth, align: 'left' });
    });
    currentY += 15;
  });

  doc.end();
  });
}

export default async function exportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', verifyWorkspaceAccess);
  fastify.addHook('preHandler', requireManager);

  // Gate: Enterprise only
  const requireEnterprise = async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.plan !== 'ENTERPRISE') {
      return reply.status(402).send({
        error: 'Data Export is an Enterprise-only feature. Please upgrade your plan.'
      });
    }
  };

  // ─── Export Tenants ───
  fastify.get('/tenants', { preHandler: requireEnterprise }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const tenants = await prisma.tenant.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        leases: {
          include: {
            property: { select: { name: true } },
            unit: { select: { unitNumber: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const rows = tenants.map((t: any) => ({
      name: t.name,
      email: t.email || '',
      phone: t.phone || '',
      property: t.leases[0]?.property?.name || '',
      unit: t.leases[0]?.unit?.unitNumber || '',
      leaseStart: t.leases[0]?.startDate ? new Date(t.leases[0].startDate).toLocaleDateString() : '',
      leaseEnd: t.leases[0]?.endDate ? new Date(t.leases[0].endDate).toLocaleDateString() : '',
      yearlyRent: t.leases[0]?.yearlyRent || '',
      createdAt: new Date(t.createdAt).toLocaleDateString()
    }));

    const csv = toCSV(rows, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'property', label: 'Property' },
      { key: 'unit', label: 'Unit' },
      { key: 'leaseStart', label: 'Lease Start' },
      { key: 'leaseEnd', label: 'Lease End' },
      { key: 'yearlyRent', label: 'Yearly Rent (₦)' },
      { key: 'createdAt', label: 'Date Added' }
    ]);

    const { format } = request.query as { format?: string };
    if (format === 'pdf') {
      await toPDF(reply, 'Tenants Report', rows, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'property', label: 'Property' },
        { key: 'unit', label: 'Unit' },
        { key: 'leaseStart', label: 'Start' },
        { key: 'yearlyRent', label: 'Rent' }
      ]);
      return reply;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=tenants-${Date.now()}.csv`);
    return reply.send(csv);
  });

  // ─── Export Payments ───
  fastify.get('/payments', { preHandler: requireEnterprise }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const payments = await prisma.payment.findMany({
      where: { workspaceId },
      include: {
        tenant: { select: { name: true, email: true } },
        property: { select: { name: true } },
        unit: { select: { unitNumber: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const rows = payments.map((p: any) => ({
      receiptId: p.receiptId || '',
      tenant: p.tenant?.name || '',
      tenantEmail: p.tenant?.email || '',
      property: p.property?.name || '',
      unit: p.unit?.unitNumber || '',
      amount: p.amount,
      status: p.status,
      paymentMethod: p.paymentMethod || '',
      paidDate: p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '',
      dueDate: p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '',
      createdAt: new Date(p.createdAt).toLocaleDateString()
    }));

    const csv = toCSV(rows, [
      { key: 'receiptId', label: 'Receipt ID' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'tenantEmail', label: 'Tenant Email' },
      { key: 'property', label: 'Property' },
      { key: 'unit', label: 'Unit' },
      { key: 'amount', label: 'Amount (₦)' },
      { key: 'status', label: 'Status' },
      { key: 'paymentMethod', label: 'Payment Method' },
      { key: 'paidDate', label: 'Date Paid' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'createdAt', label: 'Created' }
    ]);

    const { format } = request.query as { format?: string };
    if (format === 'pdf') {
      await toPDF(reply, 'Payments Ledger', rows, [
        { key: 'receiptId', label: 'ID' },
        { key: 'tenant', label: 'Tenant' },
        { key: 'property', label: 'Property' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
        { key: 'paidDate', label: 'Date' }
      ]);
      return reply;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=payments-${Date.now()}.csv`);
    return reply.send(csv);
  });

  // ─── Export Properties ───
  fastify.get('/properties', { preHandler: requireEnterprise }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId } = request.params as { workspaceId: string };

    const properties = await prisma.property.findMany({
      where: { workspaceId, deletedAt: null },
      include: {
        owner: { select: { name: true, email: true } },
        units: { select: { unitNumber: true, type: true, status: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const rows: any[] = [];
    properties.forEach((p: any) => {
      if (p.units.length === 0) {
        rows.push({
          property: p.name,
          address: p.address,
          owner: p.owner?.name || '',
          ownerEmail: p.owner?.email || '',
          unitNumber: '',
          unitType: '',
          unitStatus: '',
          createdAt: new Date(p.createdAt).toLocaleDateString()
        });
      } else {
        p.units.forEach((u: any) => {
          rows.push({
            property: p.name,
            address: p.address,
            owner: p.owner?.name || '',
            ownerEmail: p.owner?.email || '',
            unitNumber: u.unitNumber,
            unitType: u.type || '',
            unitStatus: u.status || '',
            createdAt: new Date(p.createdAt).toLocaleDateString()
          });
        });
      }
    });

    const csv = toCSV(rows, [
      { key: 'property', label: 'Property Name' },
      { key: 'address', label: 'Address' },
      { key: 'owner', label: 'Owner' },
      { key: 'ownerEmail', label: 'Owner Email' },
      { key: 'unitNumber', label: 'Unit Number' },
      { key: 'unitType', label: 'Unit Type' },
      { key: 'unitStatus', label: 'Unit Status' },
      { key: 'createdAt', label: 'Date Added' }
    ]);

    const { format } = request.query as { format?: string };
    if (format === 'pdf') {
      await toPDF(reply, 'Portfolio Report', rows, [
        { key: 'property', label: 'Property' },
        { key: 'address', label: 'Address' },
        { key: 'owner', label: 'Owner' },
        { key: 'unitNumber', label: 'Unit' },
        { key: 'unitStatus', label: 'Status' }
      ]);
      return reply;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=properties-${Date.now()}.csv`);
    return reply.send(csv);
  });
}
