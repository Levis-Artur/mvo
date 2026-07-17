import { ApiError } from '../../lib/api-client';
import type { AuthUser } from '../../lib/types';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 1024;

export function loginDestination(user: Pick<AuthUser, 'mustChangePassword'>) {
  return user.mustChangePassword ? '/change-password' : null;
}

export function loginValidationMessage(username: string, password: string) {
  return username.trim() && password ? '' : 'Вкажіть логін і пароль.';
}

export function passwordValidationMessage(
  oldPassword: string,
  newPassword: string,
  confirmation: string,
) {
  if (!oldPassword || !newPassword || !confirmation) return 'Заповніть усі поля.';
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return `Новий пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`;
  }
  if (newPassword.length > PASSWORD_MAX_LENGTH) {
    return `Новий пароль не може перевищувати ${PASSWORD_MAX_LENGTH} символи.`;
  }
  if (newPassword !== confirmation) return 'Підтвердження пароля не збігається.';
  return '';
}

export function authErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
