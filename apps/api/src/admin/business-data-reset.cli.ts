import { PrismaService } from '../prisma/prisma.service';
import { StockDocumentAttachmentStorageService } from '../stock-documents/stock-document-attachment-storage.service';
import {
  BusinessDataResetService,
  formatBusinessDataResetReport,
} from './business-data-reset.service';

async function main() {
  const prisma = new PrismaService();
  const storage = new StockDocumentAttachmentStorageService();
  const reset = new BusinessDataResetService(prisma, storage);
  try {
    const report = await reset.run({
      dryRun: process.argv.slice(2).includes('--dry-run'),
    });
    console.log(formatBusinessDataResetReport(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
