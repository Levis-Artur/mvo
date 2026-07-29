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

describe('responsible person accounting code migration', () => {
  it('keeps legacy codes nullable and makes non-null codes globally unique', () => {
    expect(schema).toMatch(/externalAccountingCode\s+String\?\s+@unique/);
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "ResponsiblePerson_externalAccountingCode_key"',
    );
  });

  it('does not backfill, delete, or rewrite legacy responsible persons', () => {
    expect(migration).not.toMatch(/\b(UPDATE|DELETE|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/SET\s+"externalAccountingCode"/i);
    expect(migration).not.toMatch(/personnelNumber/i);
  });
});
