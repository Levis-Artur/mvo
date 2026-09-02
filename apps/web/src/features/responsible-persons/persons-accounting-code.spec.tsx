/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Management, ResponsiblePerson, Service, Unit } from '@/lib/types';
import { PersonForm } from './person-form';
import { PersonsTable } from './persons-table';
import { responsiblePersonsService } from './responsible-persons.service';

jest.mock('./responsible-persons.service', () => ({
  responsiblePersonsService: {
    managements: jest.fn(),
    services: jest.fn(),
    units: jest.fn(),
    responsiblePersons: jest.fn(),
    createResponsiblePerson: jest.fn(),
    updateResponsiblePerson: jest.fn(),
  },
}));

const management = {
  id: 'management-1',
  name: 'Управління забезпечення',
  shortName: null,
  code: 'M1',
  isActive: true,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
} satisfies Management;

const secondManagement = {
  ...management,
  id: 'management-2',
  name: 'Друге управління',
  code: 'M2',
} satisfies Management;

const service = {
  id: 'service-1',
  name: 'Служба забезпечення',
  code: 'S1',
  managementId: management.id,
  isActive: true,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
} satisfies Service;

const unit = {
  id: 'unit-1',
  name: 'Підрозділ',
  code: 'U1',
  serviceId: service.id,
  isActive: true,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
} satisfies Unit;

const person: ResponsiblePerson = {
  id: 'person-1',
  lastName: 'Жигульський',
  firstName: 'Андрій',
  middleName: 'Володимирович',
  externalAccountingName: null,
  externalAccountingCode: '0057',
  position: null,
  phone: null,
  email: null,
  managementId: management.id,
  serviceId: service.id,
  unitId: unit.id,
  isActive: true,
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  management,
  service,
  unit,
};

const api = responsiblePersonsService as jest.Mocked<
  typeof responsiblePersonsService
>;

beforeEach(() => {
  api.managements.mockResolvedValue([management]);
  api.services.mockResolvedValue([service]);
  api.units.mockResolvedValue([unit]);
  api.responsiblePersons.mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 2, total: 0, totalPages: 0 },
  });
  api.createResponsiblePerson.mockResolvedValue(person);
  api.updateResponsiblePerson.mockResolvedValue(person);
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('MVO accounting code form', () => {
  it('does not render appointment order or appointment date fields', async () => {
    render(<PersonForm person={person} onClose={jest.fn()} onSaved={jest.fn()} />);

    await screen.findByLabelText(/Код МВО/);
    expect(screen.queryByLabelText('Номер наказу')).toBeNull();
    expect(screen.queryByLabelText('Дата призначення')).toBeNull();
  });

  it('reloads and shows only services of the selected management', async () => {
    const user = userEvent.setup();
    const baseServices = [
      { ...service, id: 'it-1', code: 'IT', name: 'ІТ' },
      { ...service, id: 'mtz-1', code: 'MTZ', name: 'МТЗ' },
      { ...service, id: 'uatz-1', code: 'UATZ', name: 'УАТЗ' },
    ];
    const secondServices = [
      {
        ...service,
        id: 'it-2',
        code: 'IT',
        name: 'ІТ другого управління',
        managementId: secondManagement.id,
      },
    ];
    api.managements.mockResolvedValue([management, secondManagement]);
    api.services.mockImplementation(({ managementId }) =>
      Promise.resolve(
        managementId === management.id ? baseServices : secondServices,
      ),
    );

    render(<PersonForm person={null} onClose={jest.fn()} onSaved={jest.fn()} />);
    await user.selectOptions(
      await screen.findByLabelText(/Управління/),
      management.id,
    );
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'УАТЗ' })).not.toBeNull(),
    );
    expect(screen.getByRole('option', { name: 'ІТ' })).not.toBeNull();
    expect(screen.getByRole('option', { name: 'МТЗ' })).not.toBeNull();

    await user.selectOptions(
      screen.getByLabelText(/Управління/),
      secondManagement.id,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('option', { name: 'ІТ другого управління' }),
      ).not.toBeNull(),
    );
    expect(screen.queryByRole('option', { name: 'МТЗ' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'УАТЗ' })).toBeNull();
    expect(api.services).toHaveBeenLastCalledWith({
      managementId: secondManagement.id,
    });
  });

  it('requires the code, preserves 0057 as text, and sends it unchanged', async () => {
    const user = userEvent.setup();
    render(<PersonForm person={null} onClose={jest.fn()} onSaved={jest.fn()} />);

    const input = await screen.findByLabelText(/Код МВО/);
    expect((input as HTMLInputElement).required).toBe(true);
    expect(input.getAttribute('placeholder')).toBe('Наприклад, 0057');
    await user.type(input, '0057');
    expect((input as HTMLInputElement).value).toBe('0057');

    fireEvent.submit(document.getElementById('person-form')!);

    await waitFor(() => expect(api.createResponsiblePerson).toHaveBeenCalled());
    expect(api.responsiblePersons).toHaveBeenCalledWith({
      search: '0057',
      page: 1,
      limit: 2,
    });
    expect(api.createResponsiblePerson).toHaveBeenCalledWith(
      expect.objectContaining({ externalAccountingCode: '0057' }),
    );
  });

  it('shows format and duplicate errors before creating an MVO', async () => {
    const user = userEvent.setup();
    render(<PersonForm person={null} onClose={jest.fn()} onSaved={jest.fn()} />);
    const input = await screen.findByLabelText(/Код МВО/);

    await user.type(input, '57');
    fireEvent.blur(input);
    expect(
      await screen.findByText('Код МВО повинен містити рівно 4 цифри.'),
    ).not.toBeNull();

    await user.clear(input);
    await user.type(input, '0057');
    api.responsiblePersons.mockResolvedValue({
      items: [person],
      pagination: { page: 1, limit: 2, total: 1, totalPages: 1 },
    });
    fireEvent.submit(document.getElementById('person-form')!);

    expect(
      await screen.findByText('МВО з кодом 0057 уже існує.'),
    ).not.toBeNull();
    expect(api.createResponsiblePerson).not.toHaveBeenCalled();
  });
});

describe('MVO registry actions', () => {
  function renderTable(overrides: Partial<ResponsiblePerson> = {}) {
    const handlers = {
      onView: jest.fn(),
      onEdit: jest.fn(),
      onCreateAccount: jest.fn(),
      onDelete: jest.fn(),
      onToggleActive: jest.fn(),
    };
    const renderedPerson = { ...person, ...overrides };
    const view = render(
      <PersonsTable
        accounts={new Map()}
        accountsAvailable
        canCreateAccount
        canDelete
        canEdit
        loading={false}
        persons={[renderedPerson]}
        stockPresence={{ [renderedPerson.id]: false }}
        {...handlers}
      />,
    );
    return { ...view, handlers };
  }

  it('shows the accounting code, a null fallback, and only one action trigger', () => {
    const { container, unmount } = renderTable();
    expect(screen.queryByRole('columnheader', { name: 'Код МВО' })).not.toBeNull();
    expect(screen.queryByText('0057')).not.toBeNull();
    expect(screen.queryByText('002')).toBeNull();
    expect(container.querySelectorAll('tbody td:last-child button')).toHaveLength(1);
    unmount();

    renderTable({ externalAccountingCode: null });
    expect(screen.queryByText('Не вказано')).not.toBeNull();
  });

  it('opens the portal menu, exposes all actions, and calls the selected handler', async () => {
    const user = userEvent.setup();
    const { handlers } = renderTable();
    const trigger = screen.getByRole('button', {
      name: 'Дії для МВО Жигульський Андрій Володимирович',
    });

    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(within(menu).queryByRole('menuitem', { name: 'Переглянути' })).not.toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Редагувати' })).not.toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Деактивувати' })).not.toBeNull();
    expect(within(menu).queryByRole('menuitem', { name: 'Перемістити' })).not.toBeNull();
    expect(
      within(menu)
        .getByRole('menuitem', { name: 'Видалити' })
        .classList.contains('btn-danger'),
    ).toBe(true);

    await user.click(within(menu).getByRole('menuitem', { name: 'Редагувати' }));
    expect(handlers.onEdit).toHaveBeenCalledWith(person);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape and outside click without changing the table row', async () => {
    const user = userEvent.setup();
    const { container } = renderTable();
    const trigger = screen.getByRole('button', {
      name: 'Дії для МВО Жигульський Андрій Володимирович',
    });
    const row = container.querySelector('tbody tr')!;
    const originalHeightClass = row.className;

    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(row.className).toBe(originalHeightClass);
  });
});
