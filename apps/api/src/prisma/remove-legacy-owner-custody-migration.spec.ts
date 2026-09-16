import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaDirectory = join(__dirname, '../../prisma');
const migration = readFileSync(
  join(prismaDirectory, 'migrations', '20260916000100_remove_legacy_owner_custody', 'migration.sql'),
  'utf8',
);
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');

const removedTransactionValues = [
  'TRANSFER_IN', 'TRANSFER_OUT', 'ISSUE',
  'TRANSFER_REVERSAL_OUT', 'TRANSFER_REVERSAL_IN',
  'ASSIGNMENT_OUT_DIRECT', 'ASSIGNMENT_OUT_CUSTODY',
  'ASSIGNMENT_IN_DIRECT', 'ASSIGNMENT_IN_CUSTODY',
  'ISSUE_FROM_DIRECT', 'ISSUE_FROM_CUSTODY', 'ASSIGNMENT_REVERSAL',
  'ASSIGNMENT_IN', 'ASSIGNMENT_OUT',
];

describe('remove legacy owner custody migration source', () => {
  it('locks tables and checks assumptions before any destructive DDL', () => {
    expect(migration).toContain('BEGIN;');
    expect(migration).toContain('IN ACCESS EXCLUSIVE MODE;');
    const guards = migration.slice(migration.indexOf('DO $guards$'), migration.indexOf('DROP CONSTRAINT'));
    for (const fragment of [
      'SELECT 1 FROM "CustodyBalance"',
      "IN ('TRANSFER', 'ASSIGNMENT')",
      "= 'OWNER_CUSTODY'",
      'SELECT 1 FROM "StockTransaction"',
      'WHERE "sourceCustodyBalanceId" IS NOT NULL',
      'LEGACY_BALANCE/OWNER_CUSTODY',
    ]) expect(guards).toContain(fragment);
    const transactionGuard = guards.match(
      /SELECT 1 FROM "StockTransaction"\s+WHERE "type"::text IN \(([\s\S]*?)\)/,
    )![1];
    for (const value of removedTransactionValues) {
      expect(transactionGuard).toContain("'" + value + "'");
    }
    expect(guards.match(/RAISE EXCEPTION/g)).toHaveLength(6);
    expect(migration.indexOf('END\n$guards$;')).toBeLessThan(migration.indexOf('DROP CONSTRAINT'));
    expect(migration).toContain('COMMIT;');
    expect(migration).not.toMatch(/\b(?:DELETE\s+FROM|UPDATE\s+"|TRUNCATE|CASCADE)\b/i);
    expect(migration.indexOf('DROP CONSTRAINT')).toBeLessThan(migration.indexOf('DROP TABLE "CustodyBalance"'));
    expect(migration).toContain('DROP TABLE "CustodyBalance";');
    expect(schema).not.toContain('model CustodyBalance');
    expect(schema).not.toContain('sourceCustodyBalanceId');
  });

  it('replaces all enum columns and preserves every other transaction value', () => {
    for (const enumName of ['StockDocumentType', 'StockAccountingModel', 'StockTransactionType']) {
      expect(migration).toContain('CREATE TYPE "' + enumName + '_new"');
      expect(migration).toContain('DROP TYPE "' + enumName + '";');
      expect(migration).toContain('ALTER TYPE "' + enumName + '_new" RENAME TO "' + enumName + '";');
    }
    expect(migration).toContain('ALTER TABLE "StockDocument" ALTER COLUMN "accountingModel" TYPE "StockAccountingModel_new"');
    expect(migration).toContain('ALTER TABLE "StockTransaction" ALTER COLUMN "accountingModel" TYPE "StockAccountingModel_new"');
    expect(migration).toContain('AS ENUM (\'MVO_TRANSFER\', \'ISSUE\')');
    expect(migration).toContain('AS ENUM (\'DIRECT_BALANCE\')');
    const transactionDefinition = migration.match(/CREATE TYPE "StockTransactionType_new" AS ENUM \(([\s\S]*?)\);/)![1];
    const schemaValues = schema.match(/enum StockTransactionType \{([\s\S]*?)\}/)![1].trim().split(/\s+/);
    expect([...transactionDefinition.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual(schemaValues);
    for (const value of removedTransactionValues) {
      expect(schemaValues).not.toContain(value);
      expect(transactionDefinition).not.toContain("'" + value + "'");
    }
    for (const value of ['INITIAL_BALANCE', 'RECEIPT', 'MANUAL_RECEIPT', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'IMPORT_RECEIPT', 'MVO_TRANSFER_OUT', 'MVO_TRANSFER_REVERSAL', 'ISSUE_OUT', 'ISSUE_REVERSAL']) {
      expect(schemaValues).toContain(value);
    }
  });
});
