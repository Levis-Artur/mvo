import { ApiError } from '../../lib/api-client';
import {
  authErrorMessage,
  loginDestination,
  loginValidationMessage,
  newPasswordValidationMessage,
  passwordValidationMessage,
  recoveryCodeValidationMessage,
  twoFactorTokenValidationMessage,
} from './auth-form-model';

describe('authentication presentation model', () => {
  it('shows the backend login error without technical response details', () => {
    expect(authErrorMessage(new ApiError('Невірний логін або пароль', 401), 'fallback')).toBe(
      'Невірний логін або пароль',
    );
    expect(loginValidationMessage('', '')).toBe('Вкажіть логін і пароль.');
  });

  it('keeps mustChangePassword users in the mandatory flow', () => {
    expect(loginDestination({ mustChangePassword: true })).toBe('/change-password');
    expect(loginDestination({ mustChangePassword: false })).toBeNull();
  });


  it('validates pre-auth password and second-factor inputs', () => {
    expect(newPasswordValidationMessage('short', 'short')).toContain('12');
    expect(newPasswordValidationMessage('new-password-1', 'different')).toBe(
      'Підтвердження пароля не збігається.',
    );
    expect(newPasswordValidationMessage('new-password-1', 'new-password-1')).toBe('');
    expect(twoFactorTokenValidationMessage('123456')).toBe('');
    expect(twoFactorTokenValidationMessage('12345')).toContain('6-значний');
    expect(recoveryCodeValidationMessage('ABCD-EFGH-IJKL-MNOP')).toBe('');
    expect(recoveryCodeValidationMessage('   ')).toBe('Введіть резервний код.');
  });

  it('validates the password contract before sending', () => {
    expect(passwordValidationMessage('old-password', 'short', 'short')).toContain('12');
    expect(passwordValidationMessage('old-password', 'new-password-1', 'different')).toBe(
      'Підтвердження пароля не збігається.',
    );
    expect(passwordValidationMessage('old-password', 'new-password-1', 'new-password-1')).toBe('');
  });
});
