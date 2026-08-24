import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const prismaDirectory = join(__dirname, '..', '..', 'prisma');
const schema = readFileSync(join(prismaDirectory, 'schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    prismaDirectory,
    'migrations',
    '20260824000100_add_org_manager_access_scopes',
    'migration.sql',
  ),
  'utf8',
);

describe('ORG_MANAGER access scope migration', () => {
  it('adds the role and additive UserAccessScope model', () => {
    expect(schema).toMatch(/enum UserRole[\s\S]*ORG_MANAGER/);
    expect(schema).toMatch(/model UserAccessScope/);
    expect(migration).toContain("ALTER TYPE \"UserRole\" ADD VALUE 'ORG_MANAGER'");
    expect(migration).toContain('CREATE TABLE "UserAccessScope"');
  });

  it('rejects empty scopes and enforces nullable-key uniqueness safely', () => {
    expect(migration).toContain('UserAccessScope_non_empty_check');
    expect(migration).toContain('UserAccessScope_service_code_not_blank_check');
    expect(migration).toContain('UserAccessScope_user_management_unique');
    expect(migration).toContain('UserAccessScope_user_service_unique');
    expect(migration).toContain(
      'UserAccessScope_user_management_service_unique',
    );
  });

  it('does not rewrite or delete existing users and business data', () => {
    expect(migration).not.toMatch(
      /^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b|UPDATE\s+"?\w+)/im,
    );
  });
});
