import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import { AccountingController } from './accounting.controller';

describe('AccountingController access', () => {
  it('keeps legacy accounting registers for privileged global readers, excluding ACCOUNTANT and MVO', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountingController) as UserRole[];
    expect(roles).toEqual(expect.arrayContaining([
      UserRole.OWNER,
      UserRole.DPP_ADMIN,
      UserRole.AUDITOR,
    ]));
    expect(roles).not.toContain(UserRole.MVO);
    expect(roles).not.toContain(UserRole.ACCOUNTANT);
  });

  it('allows only operational accounting roles to create an export batch', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.export,
    ) as UserRole[];
    expect(roles).toEqual([
      UserRole.OWNER,
      UserRole.DPP_ADMIN,
    ]);
    expect(roles).not.toContain(UserRole.AUDITOR);
    expect(roles).not.toContain(UserRole.MVO);
  });

  it('allows ISSUE CSV export to accounting export roles but not MVO', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.exportIssues,
    ) as UserRole[];
    expect(roles).toEqual([
      UserRole.OWNER,
      UserRole.DPP_ADMIN,
      UserRole.AUDITOR,
    ]);
    expect(roles).not.toContain(UserRole.MVO);
  });

  it('limits the legacy accounting overview to OWNER', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountingController.prototype.overview,
    ) as UserRole[];

    expect(roles).toEqual([UserRole.OWNER]);
  });

  it.each(['movements', 'exportMovements', 'movementDetails'] as const)(
    'limits %s to OWNER and ACCOUNTANT and keeps MVO denied',
    (method) => {
      const roles = Reflect.getMetadata(
        ROLES_KEY,
        AccountingController.prototype[method],
      ) as UserRole[];

      expect(roles).toEqual([UserRole.OWNER]);
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
