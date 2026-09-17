import { Prisma } from '@prisma/client';

export const issueRealizationLinesSelect = {
  quantity: true,
  realization: { select: { status: true } },
} satisfies Prisma.IssueRealizationLineSelect;

export function issueRealizationQuantity(
  quantity: Prisma.Decimal,
  realizationLines: Array<{ quantity: Prisma.Decimal; realization: { status: string } }> = [],
) {
  const realizedQuantity = realizationLines
    .filter((line) => line.realization.status === 'POSTED')
    .reduce((sum, line) => sum.plus(line.quantity), new Prisma.Decimal(0));
  return {
    realizedQuantity: realizedQuantity.toString(),
    availableToRealize: Prisma.Decimal.max(quantity.minus(realizedQuantity), new Prisma.Decimal(0)).toString(),
  };
}
