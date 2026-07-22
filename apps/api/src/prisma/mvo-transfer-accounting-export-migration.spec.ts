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
const hardeningMigration = readFileSync(
  join(
    prismaDirectory,
    'migrations',
    '20260722000100_harden_accounting_transfer_exports',
    'migration.sql',
  ),
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

  it('adds versioned export attribution without rewriting legacy snapshots', () => {
    expect(schema).toContain('exportedByUserId');
    expect(schema).toContain('exportedAt');
    expect(schema).toContain('displayNumber');
    expect(schema).toContain('formatVersion   Int       @default(2)');
    expect(hardeningMigration).not.toMatch(
      /^\s*(DROP|DELETE|TRUNCATE)\b/im,
    );
    expect(hardeningMigration).not.toContain('ALTER TABLE "StockBalance"');
    expect(hardeningMigration).not.toContain('ALTER TABLE "ImportBatch"');
    expect(hardeningMigration).toContain(
      'ADD COLUMN "formatVersion" INTEGER NOT NULL DEFAULT 1',
    );
    expect(hardeningMigration).toContain(
      'ALTER COLUMN "formatVersion" SET DEFAULT 2',
    );
    expect(
      hardeningMigration.indexOf(
        'ADD COLUMN "formatVersion" INTEGER NOT NULL DEFAULT 1',
      ),
    ).toBeLessThan(
      hardeningMigration.indexOf(
        'ALTER COLUMN "formatVersion" SET DEFAULT 2',
      ),
    );
    expect(hardeningMigration).toContain(
      'CHECK ("formatVersion" IN (1, 2))',
    );
    expect(hardeningMigration).not.toMatch(/UPDATE\s+"AccountingTransferExportRow"/i);
    expect(hardeningMigration).not.toMatch(/UPDATE\s+"AccountingTransferExportBatch"/i);
    expect(hardeningMigration).not.toMatch(/UPDATE[\s\S]+"sha256"/i);
    expect(hardeningMigration).not.toContain(
      'SET "displayNumber" = document."displayNumber"',
    );
  });
});
