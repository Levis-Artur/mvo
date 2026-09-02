import { Injectable } from '@nestjs/common';
import {
  AccountingExportState,
  StockDocumentStatus,
  StockDocumentType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AccountingOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(now = new Date()) {
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [
      activeResponsiblePersons,
      inventoryItems,
      lastImport,
      unexportedTransfers,
      currentMonthTransactions,
      recentOperations,
    ] = await Promise.all([
      this.prisma.responsiblePerson.count({ where: { isActive: true } }),
      this.prisma.inventoryItem.count(),
      this.prisma.importBatch.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalFilename: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.stockDocument.count({
        where: {
          type: StockDocumentType.MVO_TRANSFER,
          status: StockDocumentStatus.POSTED,
          accountingExportState: AccountingExportState.NOT_EXPORTED,
        },
      }),
      this.prisma.stockTransaction.count({
        where: { occurredAt: { gte: monthStart } },
      }),
      this.prisma.stockTransaction.findMany({
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        select: {
          id: true,
          type: true,
          quantity: true,
          occurredAt: true,
          sourceDocument: true,
          comment: true,
          document: { select: { displayNumber: true } },
          responsiblePerson: {
            select: {
              externalAccountingCode: true,
              lastName: true,
              firstName: true,
              middleName: true,
            },
          },
          inventoryItem: {
            select: {
              externalCode: true,
              name: true,
              unitOfMeasure: true,
            },
          },
        },
      }),
    ]);

    return {
      metrics: {
        activeResponsiblePersons,
        inventoryItems,
        unexportedTransfers,
        currentMonthTransactions,
      },
      lastImport,
      recentOperations,
    };
  }
}
