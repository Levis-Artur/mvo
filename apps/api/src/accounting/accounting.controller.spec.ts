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

  it('allows only operational accounting roles to create an export batch', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.export,
    ) as UserRole[];
    expect(roles).toEqual([
      UserRole.OWNER,
      UserRole.DPP_ADMIN,
      UserRole.ACCOUNTANT,
    ]);
    expect(roles).not.toContain(UserRole.AUDITOR);
    expect(roles).not.toContain(UserRole.MVO);
  });

  it('keeps batch history and download under read access for AUDITOR', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, AccountingController.prototype.downloadBatch),
    ).toBeUndefined();
  });
});
