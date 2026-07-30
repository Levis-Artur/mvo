/** @jest-environment jsdom */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserSummary } from '@/lib/types';
import { UsersTable } from './users-table';

const baseUser: UserSummary = {
  id: 'user-1',
  username: 'owner',
  role: 'OWNER',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
  responsiblePerson: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  passwordChangedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdById: null,
};

function renderUsers(users: UserSummary[] = [baseUser], permissions = {}) {
  const handlers = {
    onEdit: jest.fn(),
    onResetPassword: jest.fn(),
    onBlock: jest.fn(),
    onUnblock: jest.fn(),
    onRevokeSessions: jest.fn(),
    onDeactivate: jest.fn(),
    onActivate: jest.fn(),
    onDelete: jest.fn(),
  };
  const view = render(
    <UsersTable
      canDelete
      canResetPassword
      canRevokeSessions
      canWrite
      personsById={new Map()}
      users={users}
      {...permissions}
      {...handlers}
    />,
  );
  return { ...view, handlers };
}

describe('UsersTable action menu', () => {
  it('renders one compact trigger instead of the vertical action buttons', () => {
    const { container } = renderUsers();
    const trigger = screen.getByRole('button', {
      name: 'Дії для користувача owner',
    });

    expect(trigger.textContent).toBe('⋮');
    expect(trigger.getAttribute('type')).toBe('button');
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelectorAll('tbody td:last-child button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Редагувати' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Скинути пароль' })).toBeNull();
  });

  it('opens the menu with current actions and dangerous delete styling', async () => {
    const user = userEvent.setup();
    renderUsers();
    const trigger = screen.getByRole('button', {
      name: 'Дії для користувача owner',
    });

    await user.click(trigger);
    const menu = screen.getByRole('menu', {
      name: 'Дії для користувача owner',
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    for (const label of [
      'Редагувати',
      'Скинути пароль',
      'Заблокувати',
      'Відкликати сесії',
      'Деактивувати',
      'Видалити',
    ]) {
      expect(within(menu).queryByRole('menuitem', { name: label })).not.toBeNull();
    }
    expect(
      within(menu)
        .getByRole('menuitem', { name: 'Видалити' })
        .classList.contains('btn-danger'),
    ).toBe(true);
  });

  it.each([
    ['Редагувати', 'onEdit'],
    ['Скинути пароль', 'onResetPassword'],
    ['Відкликати сесії', 'onRevokeSessions'],
  ] as const)('calls the existing %s handler', async (label, handlerName) => {
    const user = userEvent.setup();
    const { handlers } = renderUsers();

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача owner' }),
    );
    await user.click(screen.getByRole('menuitem', { name: label }));

    expect(handlers[handlerName]).toHaveBeenCalledWith(baseUser);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('uses lock and activity actions that match the current state', async () => {
    const user = userEvent.setup();
    const inactiveLocked = {
      ...baseUser,
      isActive: false,
      lockedUntil: '2999-01-01T00:00:00.000Z',
    };
    const { handlers } = renderUsers([inactiveLocked]);

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача owner' }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Розблокувати' })).not.toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Активувати' })).not.toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Розблокувати' }));
    expect(handlers.onUnblock).toHaveBeenCalledWith(inactiveLocked);

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача owner' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Активувати' }));
    expect(handlers.onActivate).toHaveBeenCalledWith(inactiveLocked);
  });

  it('keeps the existing delete handler for the confirmation flow', async () => {
    const user = userEvent.setup();
    const { handlers } = renderUsers();

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача owner' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Видалити' }));

    expect(handlers.onDelete).toHaveBeenCalledWith(baseUser);
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    renderUsers();
    const trigger = screen.getByRole('button', {
      name: 'Дії для користувача owner',
    });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('invokes the action for the selected row only', async () => {
    const user = userEvent.setup();
    const secondUser = { ...baseUser, id: 'user-2', username: 'auditor' };
    const { handlers } = renderUsers([baseUser, secondUser]);

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача auditor' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Редагувати' }));

    expect(handlers.onEdit).toHaveBeenCalledTimes(1);
    expect(handlers.onEdit).toHaveBeenCalledWith(secondUser);
  });

  it('does not render actions that existing permissions deny', async () => {
    const user = userEvent.setup();
    renderUsers([baseUser], { canDelete: false, canResetPassword: false });

    await user.click(
      screen.getByRole('button', { name: 'Дії для користувача owner' }),
    );
    expect(screen.queryByRole('menuitem', { name: 'Скинути пароль' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Видалити' })).toBeNull();
  });
});
