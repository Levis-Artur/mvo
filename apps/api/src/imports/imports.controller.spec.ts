import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';

process.env.API_PORT ??= '3000';
process.env.CORS_ORIGIN ??= 'http://localhost:3001';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/mvo_test';

const { ImportsController } = jest.requireActual<
  typeof import('./imports.controller')
>('./imports.controller');

function roles(target: object) {
  return Reflect.getMetadata(ROLES_KEY, target) as UserRole[] | undefined;
}

describe('ImportsController access', () => {
  it('allows ACCOUNTANT to read import history and details', () => {
    expect(roles(ImportsController)).toEqual(expect.arrayContaining([
      UserRole.OWNER,
      UserRole.ACCOUNTANT,
    ]));
    expect(roles(ImportsController)).not.toContain(UserRole.MVO);
  });

  it.each(['upload', 'mappings', 'validate', 'commit', 'cancel'] as const)(
    'allows ACCOUNTANT to %s an import',
    (method) => {
      expect(roles(ImportsController.prototype[method])).toEqual([
        UserRole.OWNER,
        UserRole.DPP_ADMIN,
        UserRole.ACCOUNTANT,
      ]);
      expect(roles(ImportsController.prototype[method])).not.toContain(UserRole.MVO);
      expect(roles(ImportsController.prototype[method])).not.toContain(UserRole.AUDITOR);
    },
  );
});
