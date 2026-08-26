/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser, PreAuthLoginResult } from '@/lib/types';
import LoginPage from './page';
import { apiClient } from '@/lib/api-client';

const mockLogin = jest.fn();
const mockRefresh = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('../ui/auth-context', () => ({
  useAuth: () => ({
    loading: false,
    user: null,
    login: mockLogin,
    refresh: mockRefresh,
  }),
  getDefaultAppPath: () => '/users',
}));

jest.mock('qrcode-generator', () =>
  jest.fn(() => ({
    addData: jest.fn(),
    make: jest.fn(),
    createDataURL: jest.fn(() => 'data:image/gif;base64,qr-code'),
  })),
);

jest.mock('@/lib/api-client', () => {
  class MockApiError extends Error {
    status = 400;
  }
  return {
    ApiError: MockApiError,
    apiClient: {
      beginTwoFactorEnrollment: jest.fn(),
      changePasswordPreAuth: jest.fn(),
      confirmTwoFactorEnrollment: jest.fn(),
      verifyTwoFactor: jest.fn(),
      verifyTwoFactorRecovery: jest.fn(),
    },
  };
});

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

const preAuthUser = {
  id: 'user-1',
  username: 'mvo-user',
  role: 'MVO' as const,
};

const authUser: AuthUser = {
  ...preAuthUser,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: 'person-1',
  responsiblePerson: null,
};

async function submitPasswordLogin(stage: PreAuthLoginResult['stage']) {
  mockLogin.mockResolvedValue({
    requiresPreAuth: true,
    stage,
    preAuthToken: 'pre-auth-1',
    user: preAuthUser,
  });
  const user = userEvent.setup();
  render(<LoginPage />);
  await user.type(screen.getByLabelText(/Логін/), 'mvo-user');
  await user.type(screen.getByLabelText(/Пароль/), 'temporary-password');
  await user.click(screen.getByRole('button', { name: 'Продовжити' }));
  return user;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.beginTwoFactorEnrollment.mockResolvedValue({
    otpauthUrl: 'otpauth://totp/MVO%20Inventory:mvo-user?secret=SECRET',
    manualKey: 'SECRET',
  });
});

describe('mandatory 2FA login page', () => {
  it('changes a temporary password before starting 2FA enrollment', async () => {
    mockedApi.changePasswordPreAuth.mockResolvedValue({
      requiresPreAuth: true,
      stage: 'ENROLL_2FA',
      preAuthToken: 'pre-auth-2',
    });
    const user = await submitPasswordLogin('CHANGE_PASSWORD');

    expect(await screen.findByText('Обов’язкова зміна пароля')).toBeTruthy();
    await user.type(screen.getByLabelText(/Новий пароль/), 'new-secure-password');
    await user.type(
      screen.getByLabelText(/Підтвердження нового пароля/),
      'new-secure-password',
    );
    await user.click(
      screen.getByRole('button', { name: 'Змінити пароль і продовжити' }),
    );

    await waitFor(() =>
      expect(mockedApi.changePasswordPreAuth).toHaveBeenCalledWith({
        preAuthToken: 'pre-auth-1',
        newPassword: 'new-secure-password',
      }),
    );
    expect(await screen.findByText('Налаштування двофакторної автентифікації')).toBeTruthy();
    expect(mockedApi.beginTwoFactorEnrollment).toHaveBeenCalledWith('pre-auth-2');
  });

  it('renders a local QR code and shows recovery codes after enrollment confirm', async () => {
    mockedApi.confirmTwoFactorEnrollment.mockResolvedValue({
      authenticated: true,
      user: preAuthUser,
      recoveryCodes: ['ABCD-EFGH', 'IJKL-MNOP'],
    });
    const user = await submitPasswordLogin('ENROLL_2FA');

    expect(await screen.findByText('Налаштування двофакторної автентифікації')).toBeTruthy();
    expect(
      screen.getByRole('img', {
        name: 'QR-код для налаштування двофакторної автентифікації',
      }).getAttribute('src'),
    ).toBe('data:image/gif;base64,qr-code');
    expect(screen.getByText('SECRET')).toBeTruthy();

    await user.type(screen.getByLabelText(/2\. Введіть 6-значний код/), '123456');
    await user.click(screen.getByRole('button', { name: 'Увімкнути 2FA' }));

    expect(await screen.findByText('Збережіть резервні коди')).toBeTruthy();
    expect(screen.getByText('ABCD-EFGH')).toBeTruthy();
    expect(screen.getByText('IJKL-MNOP')).toBeTruthy();
  });

  it('creates the authenticated UI session only after a valid TOTP verification', async () => {
    mockedApi.verifyTwoFactor.mockResolvedValue({
      authenticated: true,
      user: preAuthUser,
    });
    mockRefresh.mockResolvedValue(authUser);
    const user = await submitPasswordLogin('VERIFY_2FA');

    expect(await screen.findByText('Підтвердження входу')).toBeTruthy();
    await user.type(screen.getByLabelText(/Код Authenticator/), '654321');
    await user.click(screen.getByRole('button', { name: 'Підтвердити вхід' }));

    await waitFor(() =>
      expect(mockedApi.verifyTwoFactor).toHaveBeenCalledWith({
        preAuthToken: 'pre-auth-1',
        token: '654321',
      }),
    );
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/users');
  });
});
