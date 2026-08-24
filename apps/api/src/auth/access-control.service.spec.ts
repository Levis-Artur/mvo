import { UserRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from './auth.types';
import { AccessControlService } from './access-control.service';

const managementA = '11111111-1111-4111-8111-111111111111';
const managementB = '22222222-2222-4222-8222-222222222222';
const responsiblePersonId = '33333333-3333-4333-8333-333333333333';

function currentUser(
  role: UserRole,
  options: Pick<CurrentUser, 'responsiblePersonId' | 'accessScopes'> = {
    responsiblePersonId: null,
    accessScopes: [],
  },
): CurrentUser {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    username: 'user',
    role,
    isActive: true,
    mustChangePassword: false,
    responsiblePersonId: options.responsiblePersonId,
    accessScopes: options.accessScopes,
  };
}

describe('AccessControlService responsible person scope', () => {
  const service = new AccessControlService({} as PrismaService);

  it('keeps OWNER global access', () => {
    expect(
      service.responsiblePersonFilter(currentUser(UserRole.OWNER)),
    ).toEqual({});
  });

  it('limits MVO to the linked responsible person', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.MVO, {
          responsiblePersonId,
          accessScopes: [],
        }),
      ),
    ).toEqual({ id: responsiblePersonId });
  });

  it('returns no data for ORG_MANAGER without scopes', () => {
    expect(
      service.responsiblePersonFilter(currentUser(UserRole.ORG_MANAGER)),
    ).toEqual({ id: { in: [] } });
    expect(service.isGlobalReader(currentUser(UserRole.ORG_MANAGER))).toBe(false);
  });

  it('builds a management-only scope', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.ORG_MANAGER, {
          responsiblePersonId: null,
          accessScopes: [{ managementId: managementA, serviceCode: null }],
        }),
      ),
    ).toEqual({ OR: [{ managementId: managementA }] });
  });

  it('builds a service scope across managements', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.ORG_MANAGER, {
          responsiblePersonId: null,
          accessScopes: [{ managementId: null, serviceCode: 'IT' }],
        }),
      ),
    ).toEqual({ OR: [{ service: { code: 'IT' } }] });
  });

  it('builds an intersected management and service scope', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.ORG_MANAGER, {
          responsiblePersonId: null,
          accessScopes: [{ managementId: managementA, serviceCode: 'IT' }],
        }),
      ),
    ).toEqual({
      OR: [{ managementId: managementA, service: { code: 'IT' } }],
    });
  });

  it('combines multiple scopes as a union', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.ORG_MANAGER, {
          responsiblePersonId: null,
          accessScopes: [
            { managementId: managementA, serviceCode: 'IT' },
            { managementId: managementB, serviceCode: 'IT' },
          ],
        }),
      ),
    ).toEqual({
      OR: [
        { managementId: managementA, service: { code: 'IT' } },
        { managementId: managementB, service: { code: 'IT' } },
      ],
    });
  });

  it('does not treat an invalid empty scope as global access', () => {
    expect(
      service.responsiblePersonFilter(
        currentUser(UserRole.ORG_MANAGER, {
          responsiblePersonId: null,
          accessScopes: [{ managementId: null, serviceCode: null }],
        }),
      ),
    ).toEqual({ id: { in: [] } });
  });

  it('composes document scope from source or destination responsible person', () => {
    const manager = currentUser(UserRole.ORG_MANAGER, {
      responsiblePersonId: null,
      accessScopes: [{ managementId: managementA, serviceCode: 'IT' }],
    });
    const responsiblePerson = {
      OR: [{ managementId: managementA, service: { code: 'IT' } }],
    };

    expect(service.stockDocumentFilter(manager)).toEqual({
      OR: [
        { sourceResponsiblePerson: responsiblePerson },
        { destinationResponsiblePerson: responsiblePerson },
      ],
    });
  });

  it('composes transaction scope from movement and document relations', () => {
    const manager = currentUser(UserRole.ORG_MANAGER, {
      responsiblePersonId: null,
      accessScopes: [{ managementId: null, serviceCode: 'IT' }],
    });
    const responsiblePerson = { OR: [{ service: { code: 'IT' } }] };

    expect(service.stockTransactionFilter(manager)).toEqual({
      OR: [
        { responsiblePerson },
        { accountingOwnerResponsiblePerson: responsiblePerson },
        { sourceCustodianResponsiblePerson: responsiblePerson },
        { destinationCustodianResponsiblePerson: responsiblePerson },
        {
          document: {
            OR: [
              { sourceResponsiblePerson: responsiblePerson },
              { destinationResponsiblePerson: responsiblePerson },
            ],
          },
        },
      ],
    });
  });

  it('never treats an ORG_MANAGER without scopes as global', () => {
    const manager = currentUser(UserRole.ORG_MANAGER);
    const noResponsiblePerson = { id: { in: [] } };

    expect(service.stockDocumentFilter(manager)).toEqual({
      OR: [
        { sourceResponsiblePerson: noResponsiblePerson },
        { destinationResponsiblePerson: noResponsiblePerson },
      ],
    });
    expect(service.stockTransactionFilter(manager)).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([{ responsiblePerson: noResponsiblePerson }]),
      }),
    );
  });
});
