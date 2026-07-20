import 'reflect-metadata';
import {
  Prisma,
  StockAccountingModel,
  StockDocumentType,
  StockSourceKind,
} from '@prisma/client';
import {
  assertCustodyPartiesDiffer,
  assertValidStockSource,
  isLegacyStockDocument,
  StockAccountingInvariantError,
  totalAccountedQuantity,
} from './stock-accounting.domain';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStockDocumentDto } from '../stock-documents/dto/stock-document.dto';

describe('owner/custody accounting domain', () => {
  it('keeps Decimal precision when direct and assigned quantities are added', () => {
    const total = totalAccountedQuantity('0.1000', ['0.2000', '1.2345']);

    expect(total).toEqual(new Prisma.Decimal('1.5345'));
    expect(total.toFixed(4)).toBe('1.5345');
  });

  it('does not allow the accounting owner to be the custodian', () => {
    expect(() => assertCustodyPartiesDiffer('person-a', 'person-a')).toThrow(
      StockAccountingInvariantError,
    );
  });

  it('validates DIRECT and ASSIGNED source semantics', () => {
    expect(() =>
      assertValidStockSource({
        sourceKind: StockSourceKind.DIRECT,
        sourceResponsiblePersonId: 'owner-a',
        accountingOwnerResponsiblePersonId: 'owner-a',
      }),
    ).not.toThrow();

    expect(() =>
      assertValidStockSource({
        sourceKind: StockSourceKind.ASSIGNED,
        sourceResponsiblePersonId: 'custodian-b',
        accountingOwnerResponsiblePersonId: 'owner-a',
        sourceCustodianResponsiblePersonId: 'custodian-b',
      }),
    ).not.toThrow();
  });

  it('keeps TRANSFER in the legacy accounting model', () => {
    expect(
      isLegacyStockDocument({
        type: StockDocumentType.TRANSFER,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
      }),
    ).toBe(true);
    expect(
      isLegacyStockDocument({
        type: StockDocumentType.ASSIGNMENT,
        accountingModel: StockAccountingModel.OWNER_CUSTODY,
      }),
    ).toBe(false);
  });

  it('keeps the legacy TRANSFER DTO valid without custody fields', async () => {
    const dto = plainToInstance(CreateStockDocumentDto, {
      documentDate: '2026-07-20T00:00:00.000Z',
      type: StockDocumentType.TRANSFER,
      sourceResponsiblePersonId: '11111111-1111-4111-8111-111111111111',
      destinationResponsiblePersonId:
        '22222222-2222-4222-8222-222222222222',
      lines: [
        {
          inventoryItemId: '33333333-3333-4333-8333-333333333333',
          quantity: '1.0000',
        },
      ],
    });

    expect(await validate(dto)).toEqual([]);
  });
});
