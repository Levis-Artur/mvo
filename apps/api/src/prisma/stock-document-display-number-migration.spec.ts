import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaDirectory = join(__dirname, '../../prisma');
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    prismaDirectory,
    'migrations',
    '20260721000100_add_stock_document_display_number',
    'migration.sql',
  ),
  'utf8',
);

describe('stock document display number migration', () => {
  it('defines a generated unique human-readable number', () => {
    expect(schema).toContain(
      'displayNumber                  Int                 @unique @default(autoincrement())',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "StockDocument_displayNumber_key"',
    );
    expect(migration).toContain(
      'ALTER COLUMN "displayNumber" SET NOT NULL',
    );
  });

  it('backfills populated databases deterministically from one', () => {
    expect(migration).toContain(
      'ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)::INTEGER',
    );
    expect(migration).toContain(
      'SET "displayNumber" = "numberedDocuments"."displayNumber"',
    );
  });

  it('continues the sequence after the highest backfilled number', () => {
    expect(migration).toContain(
      'CREATE SEQUENCE "StockDocument_displayNumber_seq"',
    );
    expect(migration).toContain('COALESCE(MAX("displayNumber"), 1)');
    expect(migration).toContain('MAX("displayNumber") IS NOT NULL');
    expect(migration).toContain(
      'SET DEFAULT nextval(\'"StockDocument_displayNumber_seq"\')',
    );
  });

  it('does not delete or rewrite legacy identifiers', () => {
    expect(migration).not.toMatch(/\b(?:DELETE|DROP|TRUNCATE)\b/i);
    expect(migration).not.toMatch(/SET\s+"documentNumber"/i);
  });
});
