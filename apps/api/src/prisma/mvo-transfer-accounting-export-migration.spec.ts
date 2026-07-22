import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaDirectory = join(__dirname, '../../prisma');
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');
const transferMigration = readFileSync(
  join(prismaDirectory, 'migrations', '20260721000200_add_mvo_transfer_direct_balance', 'migration.sql'),
  'utf8',
);
const exportMigration = readFileSync(
  join(prismaDirectory, 'migrations', '20260721000300_add_accounting_transfer_exports', 'migration.sql'),
  'utf8',
);

describe('MVO transfer and accounting export migrations', () => {
  it('adds direct MVO transfer snapshots without deleting legacy data', () => {
    expect(schema).toContain('MVO_TRANSFER');
    expect(schema).toContain('sourceBalanceId String?');
    expect(schema).toContain('quantityBefore Decimal?');
    expect(schema).toContain('quantityAfter  Decimal?');
    expect(transferMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM)\b/im);
    expect(transferMigration).not.toContain('"CustodyBalance"');
  });

  it('adds immutable export batches without stock or import mutations', () => {
    expect(schema).toContain('enum AccountingExportState');
    expect(schema).toContain('model AccountingTransferExportBatch');
    expect(schema).toContain('model AccountingTransferExportRow');
    expect(exportMigration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE\s+FROM)\b/im);
    expect(exportMigration).not.toContain('ALTER TABLE "StockBalance"');
    expect(exportMigration).not.toContain('ALTER TABLE "ImportBatch"');
  });
});
