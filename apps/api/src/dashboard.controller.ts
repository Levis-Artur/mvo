import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

type DashboardStats = {
  activeResponsiblePersons: number;
  managements: number;
  services: number;
  units: number;
  inventoryItems: number;
  inventoryItemsNeedsReview: number;
  responsiblePersonsWithStock: number;
  completedImports: number;
  importsWithErrors: number;
  recentReceiptDiscrepancies: number;
};

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats(): Promise<DashboardStats> {
    const [
      activeResponsiblePersons,
      managements,
      services,
      units,
      inventoryItems,
      inventoryItemsNeedsReview,
      responsiblePersonsWithStock,
      completedImports,
      importsWithErrors,
      recentReceiptDiscrepancies,
    ] = await Promise.all([
      this.prisma.responsiblePerson.count({ where: { isActive: true } }),
      this.prisma.management.count(),
      this.prisma.service.count(),
      this.prisma.unit.count(),
      this.prisma.inventoryItem.count(),
      this.prisma.inventoryItem.count({
        where: { reviewStatus: 'NEEDS_REVIEW' },
      }),
      this.prisma.stockBalance
        .groupBy({
          by: ['responsiblePersonId'],
          where: { quantity: { gt: 0 } },
        })
        .then((items) => items.length),
      this.prisma.importBatch.count({ where: { status: 'COMPLETED' } }),
      this.prisma.importBatch.count({
        where: { OR: [{ status: 'FAILED' }, { errorRows: { gt: 0 } }] },
      }),
      this.prisma.importRow.count({
        where: {
          balanceDifference: { not: null },
          importBatch: { type: 'RECEIPT' },
        },
      }),
    ]);

    return {
      activeResponsiblePersons,
      managements,
      services,
      units,
      inventoryItems,
      inventoryItemsNeedsReview,
      responsiblePersonsWithStock,
      completedImports,
      importsWithErrors,
      recentReceiptDiscrepancies,
    };
  }
}
