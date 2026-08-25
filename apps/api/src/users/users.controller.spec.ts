import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../auth/roles.decorator';
import { UsersController } from './users.controller';

describe('UsersController 2FA reset access', () => {
  it('allows only OWNER on resetTwoFactor', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        UsersController.prototype.resetTwoFactor,
      ),
    ).toEqual([UserRole.OWNER]);
  });
});
