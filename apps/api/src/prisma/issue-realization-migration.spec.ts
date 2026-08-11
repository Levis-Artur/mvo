import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../prisma');
const schema = readFileSync(join(root, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'migrations',
    '20260811000100_add_issue_realizations',
    'migration.sql',
  ),
  'utf8',
);

describe('ISSUE realization Prisma model and migration', () => {
  it('adds an independent POSTED/CANCELLED child ledger with Decimal lines', () => {
    expect(schema).toContain('enum IssueRealizationStatus');
    expect(schema).toContain('model IssueRealization');
    expect(schema).toContain('model IssueRealizationLine');
    expect(schema).toContain('model IssueRealizationAttachment');
    expect(schema).toContain('quantity       Decimal');
    expect(migration).toContain(
      'CREATE TYPE "IssueRealizationStatus" AS ENUM (\'POSTED\', \'CANCELLED\')',
    );
    expect(migration).toContain(
      'CONSTRAINT "IssueRealizationLine_quantity_positive" CHECK ("quantity" > 0)',
    );
  });

  it('is additive and leaves all stock and legacy rows untouched', () => {
    expect(migration).not.toMatch(
      /^\s*(?:DROP|DELETE|TRUNCATE|UPDATE)\b/im,
    );
    expect(migration).not.toContain('"StockBalance"');
    expect(migration).not.toContain('"CustodyBalance"');
    expect(migration).not.toContain('"StockTransaction"');
  });

  it('adds restrictive ISSUE/line/user relations and query indexes', () => {
    for (const fragment of [
      'IssueRealization_issueId_idx',
      'IssueRealization_status_idx',
      'IssueRealization_realizationDate_idx',
      'IssueRealizationLine_issueLineId_idx',
      'IssueRealizationAttachment_realizationId_idx',
      'ON DELETE RESTRICT ON UPDATE CASCADE',
    ]) {
      expect(migration).toContain(fragment);
    }
  });
});
