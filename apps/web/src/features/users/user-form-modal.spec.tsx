/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserSummary } from '@/lib/types';
import { UserFormModal } from './user-form-modal';
import { usersService } from './users.service';

jest.mock('./users.service', () => ({
  usersService: {
    responsiblePersons: jest.fn(),
    managements: jest.fn(),
    services: jest.fn(),
    userAccessScopes: jest.fn(),
    replaceUserAccessScopes: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
  },
}));

const mockedUsersService = usersService as jest.Mocked<typeof usersService>;

async function waitForFormLoaded() {
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
}

const manager: UserSummary = {
  id: 'manager-id',
  username: 'manager',
  role: 'ORG_MANAGER',
  isActive: true,
  mustChangePassword: false,
  twoFactorEnabled: false,
  responsiblePersonId: null,
  responsiblePerson: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  passwordChangedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdById: 'owner-id',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUsersService.responsiblePersons.mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 1 },
  });
  mockedUsersService.managements.mockResolvedValue([
    {
      id: 'management-1',
      name: 'Волинське управління',
      shortName: null,
      code: 'VOLYN',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'management-2',
      name: 'Львівське управління',
      shortName: null,
      code: 'LVIV',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
  mockedUsersService.services.mockResolvedValue([
    {
      id: 'service-1',
      name: 'IT Волинь',
      code: 'IT',
      managementId: 'management-1',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'service-2',
      name: 'МТЗ Волинь',
      code: 'MTZ',
      managementId: 'management-1',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'service-3',
      name: 'УАТЗ Волинь',
      code: 'UATZ',
      managementId: 'management-1',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'service-4',
      name: 'ІТ Львів',
      code: 'IT',
      managementId: 'management-2',
      isActive: true,
      createdAt: '',
      updatedAt: '',
    },
  ]);
  mockedUsersService.userAccessScopes.mockResolvedValue([]);
  mockedUsersService.updateUser.mockResolvedValue(manager);
  mockedUsersService.createUser.mockResolvedValue({
    user: manager,
    temporaryPassword: 'temporary-password',
  });
  mockedUsersService.replaceUserAccessScopes.mockResolvedValue([]);
});

describe('UserFormModal manager access scopes', () => {
  it('shows the Ukrainian manager role and scopes only for ORG_MANAGER', async () => {
    const user = userEvent.setup();
    render(
      <UserFormModal
        mode="users"
        user={null}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await waitForFormLoaded();

    const role = screen.getByLabelText(/Роль/);
    expect(
      (screen.getByRole('option', { name: 'Менеджер' }) as HTMLOptionElement)
        .value,
    ).toBe('ORG_MANAGER');
    expect(screen.queryByText('Області доступу')).toBeNull();

    await user.selectOptions(role, 'ORG_MANAGER');
    expect(screen.getByText('Області доступу')).toBeTruthy();

    await user.selectOptions(role, 'AUDITOR');
    expect(screen.queryByText('Області доступу')).toBeNull();
  });

  it('adds and removes several scope rows', async () => {
    const user = userEvent.setup();
    render(
      <UserFormModal
        mode="users"
        user={manager}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await waitForFormLoaded();

    expect(mockedUsersService.userAccessScopes).toHaveBeenCalledWith(
      'manager-id',
    );
    await user.click(screen.getByRole('button', { name: '+ Додати область' }));
    await user.click(screen.getByRole('button', { name: '+ Додати область' }));
    expect(screen.getAllByLabelText('Управління')).toHaveLength(2);

    await user.click(
      screen.getByRole('button', { name: 'Видалити область 1' }),
    );
    expect(screen.getAllByLabelText('Управління')).toHaveLength(1);
  });

  it('blocks the global all-managements and all-services combination', async () => {
    const user = userEvent.setup();
    render(
      <UserFormModal
        mode="users"
        user={null}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await waitForFormLoaded();

    await user.type(screen.getByLabelText(/Логін/), 'manager');
    await user.selectOptions(screen.getByLabelText(/Роль/), 'ORG_MANAGER');
    await user.click(screen.getByRole('button', { name: '+ Додати область' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    expect(
      await screen.findByText(/Глобальний доступ менеджеру не дозволено/),
    ).toBeTruthy();
    expect(mockedUsersService.createUser).not.toHaveBeenCalled();
  });

  it('loads existing scopes into edit mode', async () => {
    mockedUsersService.userAccessScopes.mockResolvedValue([
      {
        id: 'scope-1',
        userId: 'manager-id',
        managementId: 'management-1',
        serviceCode: 'IT',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'scope-2',
        userId: 'manager-id',
        managementId: null,
        serviceCode: 'MTZ',
        createdAt: '',
        updatedAt: '',
      },
    ]);

    render(
      <UserFormModal
        mode="users"
        user={manager}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await waitForFormLoaded();

    expect(screen.getAllByLabelText('Управління')).toHaveLength(2);
    expect(
      (screen.getAllByLabelText('Управління')[0] as HTMLSelectElement).value,
    ).toBe('management-1');
    expect(
      (screen.getAllByLabelText('Служба')[0] as HTMLSelectElement).value,
    ).toBe('IT');
    expect(
      (screen.getAllByLabelText('Служба')[1] as HTMLSelectElement).value,
    ).toBe('MTZ');
  });

  it('shows canonical services for the selected management and unique codes globally', async () => {
    const user = userEvent.setup();
    render(
      <UserFormModal
        mode="users"
        user={manager}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    await waitForFormLoaded();

    await user.click(screen.getByRole('button', { name: '+ Додати область' }));
    const management = screen.getByLabelText('Управління');
    const service = screen.getByLabelText('Служба') as HTMLSelectElement;
    expect([...service.options].map((option) => option.text)).toEqual([
      'Усі служби',
      'ІТ',
      'МТЗ',
      'УАТЗ',
    ]);

    await user.selectOptions(management, 'management-1');
    expect([...service.options].map((option) => option.text)).toEqual([
      'Усі служби',
      'ІТ',
      'МТЗ',
      'УАТЗ',
    ]);
  });

  it('saves a new manager and then replaces the complete scope set', async () => {
    const user = userEvent.setup();
    const onSaved = jest.fn();
    render(
      <UserFormModal
        mode="users"
        user={null}
        onClose={jest.fn()}
        onSaved={onSaved}
      />,
    );
    await waitForFormLoaded();

    await user.type(screen.getByLabelText(/Логін/), 'manager');
    await user.selectOptions(screen.getByLabelText(/Роль/), 'ORG_MANAGER');
    await user.click(screen.getByRole('button', { name: '+ Додати область' }));
    await user.selectOptions(screen.getByLabelText('Управління'), 'management-1');
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Зберегти' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));

    await waitFor(() =>
      expect(mockedUsersService.replaceUserAccessScopes).toHaveBeenCalledWith(
        'manager-id',
        [{ managementId: 'management-1', serviceCode: null }],
      ),
    );
    expect(onSaved).toHaveBeenCalledWith('temporary-password');
  });
});
