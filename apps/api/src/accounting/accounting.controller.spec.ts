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

  it('limits the accounting workspace overview to OWNER and ACCOUNTANT', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.overview,
    ) as UserRole[];

    expect(roles).toEqual([UserRole.OWNER, UserRole.ACCOUNTANT]);
  });

  it.each(['movements', 'exportMovements', 'movementDetails'] as const)(
    'limits %s to OWNER and ACCOUNTANT and keeps MVO denied',
    (method) => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        AccountingController.prototype[method],
      ) as UserRole[];

      expect(roles).toEqual([UserRole.OWNER, UserRole.ACCOUNTANT]);
      expect(roles).not.toContain(UserRole.MVO);
    },
  );

  it('keeps accounting document details read-only and unavailable to MVO', () => {
    const methodRoles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.documentDetails,
    ) as UserRole[] | undefined;
    const controllerRoles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController,
    ) as UserRole[];

    expect(methodRoles).toBeUndefined();
    expect(controllerRoles).not.toContain(UserRole.MVO);
    expect(controllerRoles).toEqual(
      expect.arrayContaining([
        UserRole.OWNER,
        UserRole.DPP_ADMIN,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
      ]),
    );
  });

  it('keeps batch history and download under read access for AUDITOR', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, AccountingController.prototype.downloadBatch),
    ).toBeUndefined();
  });
});
