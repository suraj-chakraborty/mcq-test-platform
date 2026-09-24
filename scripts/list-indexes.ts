import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const collectionsRes: any = await prisma.$runCommandRaw({ listCollections: 1 });
  console.log('\n=== MONGO DB INDEXES AUDIT ===');
  for (const col of collectionsRes.cursor.firstBatch) {
    if (['Test', 'TestAttempt', 'DescriptiveTest', 'User', 'Question', 'PdfDocument'].includes(col.name)) {
      const idxRes: any = await prisma.$runCommandRaw({ listIndexes: col.name });
      console.log(`\nCollection [${col.name}] Indexes:`);
      for (const idx of idxRes.cursor.firstBatch) {
        console.log(` - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${!!idx.unique})`);
      }
    }
  }
}

main()
  .catch((err) => {
    console.error('Error listing indexes:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
