import {
  Prisma,
  StockAccountingModel,
  StockDocumentType,
  StockSourceKind,
} from '@prisma/client';

export type StockSourceReference = {
  sourceKind: StockSourceKind;
  sourceResponsiblePersonId: string;
  accountingOwnerResponsiblePersonId: string;
  sourceCustodianResponsiblePersonId?: string | null;
  sourceCustodyBalanceId?: string | null;
};

export class StockAccountingInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockAccountingInvariantError';
  }
}

export function assertCustodyPartiesDiffer(
  accountingOwnerResponsiblePersonId: string,
  custodianResponsiblePersonId: string,
): void {
  if (
    accountingOwnerResponsiblePersonId === custodianResponsiblePersonId
  ) {
    throw new StockAccountingInvariantError(
      'Обліковий власник і фактичний утримувач мають бути різними МВО.',
    );
  }
}

export function assertValidStockSource(source: StockSourceReference): void {
  if (source.sourceKind === StockSourceKind.DIRECT) {
    if (
      source.sourceResponsiblePersonId !==
      source.accountingOwnerResponsiblePersonId
    ) {
      throw new StockAccountingInvariantError(
        'DIRECT-джерело повинно належати обліковому власнику.',
      );
    }

    if (
      source.sourceCustodianResponsiblePersonId ||
      source.sourceCustodyBalanceId
    ) {
      throw new StockAccountingInvariantError(
        'DIRECT-джерело не може посилатися на custody balance.',
      );
    }

    return;
  }

  if (
    !source.sourceCustodianResponsiblePersonId ||
    source.sourceCustodianResponsiblePersonId !==
      source.sourceResponsiblePersonId
  ) {
    throw new StockAccountingInvariantError(
      'ASSIGNED-джерело повинно належати поточному фактичному утримувачу.',
    );
  }

  assertCustodyPartiesDiffer(
    source.accountingOwnerResponsiblePersonId,
    source.sourceCustodianResponsiblePersonId,
  );
}

export function totalAccountedQuantity(
  directQuantity: Prisma.Decimal.Value,
  assignedQuantities: Prisma.Decimal.Value[],
): Prisma.Decimal {
  return assignedQuantities.reduce<Prisma.Decimal>(
    (total, quantity) => total.plus(quantity),
    new Prisma.Decimal(directQuantity),
  );
}

export function isLegacyStockDocument(input: {
  type: StockDocumentType;
  accountingModel?: StockAccountingModel | null;
}): boolean {
  return (
    input.type === StockDocumentType.TRANSFER ||
    input.accountingModel !== StockAccountingModel.OWNER_CUSTODY
  );
}
