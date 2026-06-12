if (process.env.NODE_ENV === "production") throw new Error("CRITICAL: Cannot run test scripts in production!");

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const payment = await prisma.payment.findFirst({
    where: {
      status: "UNDER_REVIEW",
      lease: { tenant: { email: "djokn@gmail.com" } }
    }
  });

  if (payment) {
    console.log("Found payment:", payment.id, "amountPaid:", payment.amountPaid);
    
    // Create pending transaction
    if (payment.amountPaid && payment.amountPaid > 0) {
      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          amount: payment.amountPaid,
          status: "PENDING",
          proofUrl: payment.proofUrl,
          note: "Proof of payment submitted"
        }
      });
      console.log("Created PENDING transaction for", payment.amountPaid);
    }

    // Reset amountPaid
    await prisma.payment.update({
      where: { id: payment.id },
      data: { amountPaid: 0 }
    });
    console.log("Reset payment.amountPaid to 0");
  } else {
    console.log("No UNDER_REVIEW payment found for djokn");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
