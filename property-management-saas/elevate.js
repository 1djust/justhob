const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide an email address.');
    console.error('Usage: node elevate.js <user@email.com>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { role: 'SUPER_ADMIN' },
    });

    console.log(`✅ Success! Elevated ${user.email} to SUPER_ADMIN.`);
    console.log(`You can now log in at http://localhost:3000/login to access the God Mode dashboard.`);
  } catch (error) {
    if (error.code === 'P2025') {
      console.error(`❌ User with email "${email}" not found in the database.`);
      console.log(`Make sure you have signed up in the web app first!`);
    } else {
      console.error('❌ An error occurred:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
