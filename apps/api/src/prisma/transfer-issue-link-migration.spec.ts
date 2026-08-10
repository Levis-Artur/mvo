import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '../../prisma');
const schema = readFileSync(join(root, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    root,
    'migrations',
    '20260810000100_link_issue_to_mvo_transfer',
    'migration.sql',
  ),
  'utf8',
);

describe('transfer-based ISSUE migration', () => {
  it('adds nullable parent relations for legacy-safe document and line links', () => {
    expect(schema).toContain(
      'sourceTransferId               String?             @db.Uuid',
    );
    expect(schema).toContain(
      'sourceTransferLineId String?         @db.Uuid',
    );
    expect(schema).toContain('@relation("TransferIssues"');
    expect(schema).toContain('@relation("TransferIssueLines"');
    expect(migration).toContain('ADD COLUMN "sourceTransferId" UUID');
    expect(migration).toContain('ADD COLUMN "sourceTransferLineId" UUID');
  });

  it('adds indexes and restrictive foreign keys without modifying legacy rows', () => {
    expect(migration).toContain('"StockDocument_sourceTransferId_idx"');
    expect(migration).toContain(
      '"StockDocumentLine_sourceTransferLineId_idx"',
    );
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(migration).not.toMatch(
      /^\s*(?:DROP|DELETE|TRUNCATE|UPDATE)\b/im,
    );
  });
});
