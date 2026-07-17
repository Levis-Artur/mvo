import type { Management, ResponsiblePerson } from '../../lib/types';
import {
  organizationRoleAccess,
  organizationFormError,
  organizationSummary,
  peopleForService,
  peopleForUnit,
  refreshAfterOrganizationMutation,
} from './organization-model';

const managements = [
  {
    id: 'm-1',
    services: [
      {
        id: 's-1',
        units: [{ id: 'u-1' }, { id: 'u-2' }],
      },
    ],
  },
] as Management[];

const people = [
  { id: 'p-1', managementId: 'm-1', serviceId: 's-1', unitId: 'u-1' },
  { id: 'p-2', managementId: 'm-1', serviceId: 's-1', unitId: 'u-2' },
] as ResponsiblePerson[];

describe('organization presentation model', () => {
  it('keeps AUDITOR read-only and destructive actions OWNER-only', () => {
    expect(organizationRoleAccess('AUDITOR')).toEqual({
      readOnly: true,
      canWrite: false,
      canDelete: false,
    });
    expect(organizationRoleAccess('OWNER').canDelete).toBe(true);
    expect(organizationRoleAccess('MVO').canDelete).toBe(false);
  });

  it('builds management, service and unit counts from existing API data', () => {
    expect(organizationSummary(managements, people)).toEqual([
      { id: 'm-1', services: 1, units: 2, people: 2 },
    ]);
    expect(peopleForService(people, 's-1')).toHaveLength(2);
    expect(peopleForUnit(people, 'u-2')).toEqual([people[1]]);
  });

  it('keeps the exact API error visible in the edit modal', () => {
    expect(organizationFormError(new Error('Код уже використовується'))).toBe(
      'Код уже використовується',
    );
  });

  it('refreshes organization data after a successful edit', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);
    await refreshAfterOrganizationMutation(refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
