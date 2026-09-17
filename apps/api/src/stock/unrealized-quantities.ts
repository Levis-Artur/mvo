import { IssueRealizationStatus, Prisma, StockDocumentStatus, StockDocumentType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export async function unrealizedQuantities(
  prisma: PrismaService,
  responsiblePersonId: string,
  inventoryItemIds?: string[],
) {
  const totals = new Map<string, Prisma.Decimal>();
  if (inventoryItemIds?.length === 0) return totals;
  const issueLines = await prisma.stockDocumentLine.findMany({
    where: {
      inventoryItemId: inventoryItemIds ? { in: inventoryItemIds } : undefined,
      document: {
        type: StockDocumentType.ISSUE,
        status: StockDocumentStatus.POSTED,
        sourceResponsiblePersonId: responsiblePersonId,
      },
    },
    select: {
      inventoryItemId: true,
      quantity: true,
      realizationLines: {
        where: { realization: { status: IssueRealizationStatus.POSTED } },
        select: { quantity: true },
      },
    },
  });
  for (const line of issueLines) {
    const realizedQuantity = line.realizationLines.reduce(
      (sum, realizationLine) => sum.plus(realizationLine.quantity),
      new Prisma.Decimal(0),
    );
    const unrealizedQuantity = line.quantity.minus(realizedQuantity);
    totals.set(line.inventoryItemId,
      (totals.get(line.inventoryItemId) ?? new Prisma.Decimal(0)).plus(unrealizedQuantity));
  }
  return totals;
}
