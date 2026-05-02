import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const analyses = await prisma.analysis.findMany({
    where: { status: 'TRADING' }
  });
  console.log('ACTIVE POSITIONS IN DB:');
  console.log(JSON.stringify(analyses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
