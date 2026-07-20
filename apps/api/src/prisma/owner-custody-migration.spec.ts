import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, StockTransactionType } from '@prisma/client';

const prismaDirectory = join(__dirname, '../../prisma');
const migrationPath = join(
  prismaDirectory,
  'migrations',
  '20260720000100_add_owner_custody_accounting_foundation',
  'migration.sql',
);
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');
const migration = readFileSync(migrationPath, 'utf8');

describe('owner/custody Prisma model and migration', () => {
  it('defines a unique Decimal CustodyBalance with indexed relations', () => {
    expect(schema).toContain('model CustodyBalance');
    expect(schema).toContain('quantity                              Decimal');
    expect(schema).toContain(
      '@@unique([inventoryItemId, accountingOwnerResponsiblePersonId, custodianResponsiblePersonId])',
    );
    expect(migration).toContain(
      'CONSTRAINT "CustodyBalance_quantity_nonnegative_check" CHECK ("quantity" >= 0)',
    );
    expect(migration).toContain(
      'CONSTRAINT "CustodyBalance_owner_differs_from_custodian_check"',
    );
  });

  it('is additive for a populated legacy database', () => {
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bUPDATE\s+"?(?:StockDocument|StockTransaction|StockBalance)"?\b/i);
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDROP\s+COLUMN\b/i);
    expect(migration).toContain(
      'ADD COLUMN "accountingOwnerResponsiblePersonId" UUID',
    );
    expect(migration).not.toContain(
      'ADD COLUMN "accountingOwnerResponsiblePersonId" UUID NOT NULL',
    );
    expect(migration).toContain(
      'ALTER TYPE "StockDocumentType" ADD VALUE \'ASSIGNMENT\'',
    );
    expect(migration).not.toMatch(/ALTER TYPE "StockDocumentType"[^;]*DROP/i);
  });

  it('preserves legacy TRANSFER line uniqueness and adds owner-aware uniqueness', () => {
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "StockDocumentLine_legacy_document_item_key"',
    );
    expect(migration).toContain(
      'WHERE "accountingOwnerResponsiblePersonId" IS NULL',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "StockDocumentLine_owner_document_item_key"',
    );
    expect(migration).toContain(
      'WHERE "accountingOwnerResponsiblePersonId" IS NOT NULL',
    );
  });

  it('keeps a legacy StockTransaction create input valid without new fields', () => {
    const legacyTransaction = {
      type: StockTransactionType.INITIAL_BALANCE,
      responsiblePersonId: '00000000-0000-0000-0000-000000000001',
      inventoryItemId: '00000000-0000-0000-0000-000000000002',
      quantity: new Prisma.Decimal('1.0000'),
      balanceBefore: new Prisma.Decimal('0.0000'),
      balanceAfter: new Prisma.Decimal('1.0000'),
      occurredAt: new Date('2026-07-20T00:00:00.000Z'),
    } satisfies Prisma.StockTransactionUncheckedCreateInput;

    expect(legacyTransaction.type).toBe(StockTransactionType.INITIAL_BALANCE);
    expect(legacyTransaction.quantity.toFixed(4)).toBe('1.0000');
  });

  it('contains all relations and indexes required by an empty database rollout', () => {
    for (const fragment of [
      'CREATE TABLE "CustodyBalance"',
      'CREATE TABLE "StockDocumentAttachment"',
      'CustodyBalance_inventoryItemId_idx',
      'CustodyBalance_accountingOwnerResponsiblePersonId_idx',
      'CustodyBalance_custodianResponsiblePersonId_idx',
      'StockDocumentAttachment_documentId_idx',
      'StockDocument_status_idx',
      'StockDocument_documentDate_idx',
      'StockTransaction_documentId_idx',
    ]) {
      expect(migration).toContain(fragment);
    }
  });
});
