import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AccessControlService } from '../access-control.service';
import type { CurrentUser } from '../auth.types';
import { ListStockDocumentsQueryDto } from '../../stock-documents/dto/stock-document.dto';

const actor: CurrentUser = {
  id: 'mvo-user', username: 'mvo', role: UserRole.MVO,
  responsiblePersonId: 'own-person', isActive: true, mustChangePassword: false,
  accessScopes: [],
};

describe('read access query authorization', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const access = new AccessControlService({} as never);
  const metadata = { type: 'query' as const, metatype: ListStockDocumentsQueryDto };

  it('does not authorize scoped reads with scopes forged in a query', async () => {
    const query = await pipe.transform({
      accessMode: 'SCOPED_READ', accessScopes: [{ serviceCode: 'IT' }], role: 'ORG_MANAGER',
    }, metadata) as ListStockDocumentsQueryDto;
    expect(query).not.toHaveProperty('accessScopes');
    expect(query).not.toHaveProperty('role');
    expect(() => access.forRead(actor, query.accessMode)).toThrow(ForbiddenException);
  });

  it('rejects unknown query modes', async () => {
    await expect(pipe.transform({ accessMode: 'ALL' }, metadata)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the authenticated actor intact and uses only server scopes', () => {
    const scopedActor = { ...actor, accessScopes: [{ managementId: null, serviceCode: 'IT' }] };
    expect(access.forRead(scopedActor).accessScopes).toEqual([]);
    expect(scopedActor.accessScopes).toHaveLength(1);
    expect(access.forRead(scopedActor, 'SCOPED_READ')).toBe(scopedActor);
    expect(() => access.forRead({ ...actor, accessScopes: [{ managementId: null, serviceCode: null }] }, 'SCOPED_READ'))
      .toThrow(ForbiddenException);
  });

  it('preserves ORG_MANAGER scope semantics in either read mode', () => {
    for (const scopes of [[], [{ managementId: null, serviceCode: 'IT' }]]) {
      const manager = { ...actor, role: UserRole.ORG_MANAGER, accessScopes: scopes };
      expect(access.forRead(manager)).toBe(manager);
      expect(access.forRead(manager, 'SCOPED_READ')).toBe(manager);
    }
  });
});
