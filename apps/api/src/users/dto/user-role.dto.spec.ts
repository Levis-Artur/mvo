import { UserRole } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

describe('user role DTO validation', () => {
  it('exposes exactly the supported Prisma roles', () => {
    expect(Object.values(UserRole).sort()).toEqual([
      'ACCOUNTANT', 'MVO', 'ORG_MANAGER', 'OWNER',
    ]);
  });

  describe.each([CreateUserDto, UpdateUserDto])('%s', (Dto) => {
    it.each(['AUDITOR', 'DPP_ADMIN'])('rejects retired role %s', async (role) => {
      const dto = Object.assign(new Dto(), { username: 'test-user', role });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'role')).toBe(true);
    });

    it.each([UserRole.ACCOUNTANT, UserRole.ORG_MANAGER, UserRole.MVO])(
      'accepts assignable role %s', async (role) => {
        const dto = Object.assign(new Dto(), { username: 'test-user', role });
        expect(await validate(dto)).toEqual([]);
      },
    );
  });

  it('rejects OWNER on ordinary creation but accepts it when editing an OWNER', async () => {
    const create = Object.assign(new CreateUserDto(), {
      username: 'another-owner', role: UserRole.OWNER,
    });
    expect((await validate(create)).some((error) => error.property === 'role')).toBe(true);
    const update = Object.assign(new UpdateUserDto(), { role: UserRole.OWNER });
    expect(await validate(update)).toEqual([]);
  });
});
