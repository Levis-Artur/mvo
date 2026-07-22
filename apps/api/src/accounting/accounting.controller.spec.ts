import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import { AccountingController } from './accounting.controller';

describe('AccountingController access', () => {
  it('allows accounting readers and excludes MVO', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountingController) as UserRole[];
    expect(roles).toEqual(expect.arrayContaining([
      UserRole.ACCOUNTANT,
      UserRole.OWNER,
      UserRole.DPP_ADMIN,
      UserRole.AUDITOR,
    ]));
    expect(roles).not.toContain(UserRole.MVO);
  });
});
