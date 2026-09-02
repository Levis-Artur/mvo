import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaDirectory = join(__dirname, '..', '..', 'prisma');
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    prismaDirectory,
    'migrations',
    '20260729000100_unique_mvo_accounting_code',
    'migration.sql',
  ),
  'utf8',
);
const personnelNumberRemovalMigration = readFileSync(
  join(
    prismaDirectory,
    'migrations',
    '20260902091000_drop_responsible_person_personnel_number',
    'migration.sql',
  ),
  'utf8',
);

describe('responsible person accounting code migration', () => {
  it('keeps accounting codes required and globally unique', () => {
    expect(schema).toMatch(/externalAccountingCode\s+String\s+@unique/);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ResponsiblePerson_externalAccountingCode_key"',
    );
  });

  it('does not backfill, delete, or rewrite legacy responsible persons', () => {
    expect(migration).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/SET\s+"externalAccountingCode"/i);
    expect(migration).not.toMatch(/personnelNumber/i);
  });

  it('drops the internal number and migrates accounting export snapshots', () => {
    expect(schema).not.toMatch(/^\s*personnelNumber\s/m);
    expect(personnelNumberRemovalMigration).toContain(
      'DROP COLUMN "personnelNumber"',
    );
    expect(personnelNumberRemovalMigration).toContain(
      'ALTER COLUMN "externalAccountingCode" SET NOT NULL',
    );
    expect(personnelNumberRemovalMigration).toContain(
      'ADD COLUMN "sourceAccountingCode" TEXT NOT NULL DEFAULT',
    );
    expect(personnelNumberRemovalMigration).toContain(
      'ADD COLUMN "destinationAccountingCode" TEXT NOT NULL DEFAULT',
    );
    expect(personnelNumberRemovalMigration).toContain(
      'SET "sourceAccountingCode" = person."externalAccountingCode"',
    );
    expect(personnelNumberRemovalMigration).toContain(
      'SET "destinationAccountingCode" = person."externalAccountingCode"',
    );
  });
});
