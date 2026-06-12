if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { email: 'djokn@gmail.com' },
    include: {
      leases: {
        include: {
          payments: true
        }
      }
    }
  });

  if (!tenant) return console.log("Tenant not found");
  
  const payments = tenant.leases.flatMap(l => l.payments);
  console.log("Payments for djokn:", payments.map(p => ({
    id: p.id,
    status: p.status,
    amountDue: p.amountDue,
    amountPaid: p.amountPaid,
    dueDate: p.dueDate
  })));

  // If there are no pending payments, let's update one to PENDING for the user to test again
  const pendingPayment = payments.find(p => p.status === 'PENDING' || p.status === 'OVERDUE');
  if (!pendingPayment) {
    console.log("No pending payment found. Changing the first payment back to PENDING...");
    if (payments.length > 0) {
      await prisma.payment.update({
        where: { id: payments[0].id },
        data: { status: 'PENDING', amountPaid: 0, partialPaymentPromiseDate: null }
      });
      console.log("Successfully reset payment to PENDING so the user can test again.");
    } else {
      console.log("No payments at all to reset.");
    }
  } else {
    console.log("There is already a payment in status:", pendingPayment.status);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
