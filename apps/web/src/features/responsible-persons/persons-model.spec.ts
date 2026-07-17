import type { ResponsiblePerson, Service, Unit } from '../../lib/types';
import {
  applyPersonFilters,
  personDisplayName,
  personRoleAccess,
  servicesForManagement,
  unitsForService,
} from './persons-model';

describe('responsible persons presentation model', () => {
  it('applies draft filters only on demand and resets pagination', () => {
    expect(
      applyPersonFilters(
        { search: '  003  ', managementId: 'm-1', isActive: true },
        50,
      ),
    ).toEqual({
      search: '003',
      managementId: 'm-1',
      serviceId: undefined,
      unitId: undefined,
      isActive: true,
      page: 1,
      limit: 50,
    });
  });

  it('keeps role-based actions read-only for AUDITOR and destructive for OWNER only', () => {
    expect(personRoleAccess('OWNER')).toMatchObject({
      canWrite: true,
      canDelete: true,
    });
    expect(personRoleAccess('AUDITOR')).toEqual({
      readOnly: true,
      canWrite: false,
      canDelete: false,
      canCreateAccount: false,
    });
    expect(personRoleAccess('MVO').canDelete).toBe(false);
  });

  it('filters services and units without changing API data', () => {
    const services = [
      { id: 's-1', managementId: 'm-1' },
      { id: 's-2', managementId: 'm-2' },
    ] as Service[];
    const units = [
      { id: 'u-1', serviceId: 's-1' },
      { id: 'u-2', serviceId: 's-2' },
    ] as Unit[];
    expect(servicesForManagement(services, 'm-1')).toHaveLength(1);
    expect(unitsForService(units, 's-2')).toEqual([units[1]]);
  });

  it('formats the person name used by the table and details card', () => {
    const person = {
      lastName: 'Левіс',
      firstName: 'Артур',
      middleName: 'Сергійович',
    } as ResponsiblePerson;
    expect(personDisplayName(person)).toBe('Левіс Артур Сергійович');
  });
});
