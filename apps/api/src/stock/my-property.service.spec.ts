import { BadRequestException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import {
  ExportMyPropertyQueryDto,
  ListMyPropertyQueryDto,
  MyPropertyExportSection,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from './dto/my-property-query.dto';
import { MyPropertyService } from './my-property.service';

const mvoId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const user: CurrentUser = {
  id: '44444444-4444-4444-8444-444444444444',
  username: 'mvo',
  role: UserRole.MVO,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: mvoId,
};

const organization = { name: 'Управління забезпечення' };
const service = { name: 'Служба майна' };
const unit = { name: 'Підрозділ 1' };
const mvoPerson = {
  id: mvoId,
  lastName: 'Левіс',
  firstName: 'Артур',
  middleName: 'Сергійович',
  personnelNumber: '002',
  management: organization,
  service,
  unit,
};
const otherPerson = {
  ...mvoPerson,
  id: otherId,
  lastName: 'Інший',
  firstName: 'Утримувач',
  personnelNumber: '003',
};
const item = {
  id: itemId,
  externalCode: 'KB-001',
  name: 'Клавіатура провідна',
  unitOfMeasure: 'шт',
};
const directRow = {
  id: '55555555-5555-4555-8555-555555555555',
  quantity: new Prisma.Decimal('4.5000'),
  updatedAt: new Date('2026-07-20T10:00:00.000Z'),
  inventoryItem: item,
  responsiblePerson: mvoPerson,
};
const custodyRow = {
  id: '66666666-6666-4666-8666-666666666666',
  quantity: new Prisma.Decimal('2.2500'),
  updatedAt: new Date('2026-07-20T11:00:00.000Z'),
  inventoryItem: item,
  accountingOwnerResponsiblePerson: mvoPerson,
  custodianResponsiblePerson: otherPerson,
};

function createService() {
  const prisma = {
    stockBalance: {
      findMany: jest.fn().mockResolvedValue([directRow]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('4.5') },
        _count: 1,
      }),
    },
    custodyBalance: {
      findMany: jest.fn().mockResolvedValue([custodyRow]),
      count: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('2') },
        _count: 1,
      }),
    },
    responsiblePerson: {
      findUnique: jest.fn().mockResolvedValue({ personnelNumber: '002' }),
    },
  };
  return { prisma, service: new MyPropertyService(prisma as never) };
}

function query(section: MyPropertySection, search?: string): ListMyPropertyQueryDto {
  return {
    section,
    search,
    page: 1,
    limit: 20,
    sortBy: MyPropertySortBy.NAME,
    sortOrder: SortOrder.ASC,
  };
}

async function streamText(stream: NodeJS.ReadableStream) {
  let result = '';
  for await (const chunk of stream) result += chunk.toString();
  return result;
}

describe('MyPropertyService', () => {
  it.each([
    ['кодом', 'KB-001', 'externalCode'],
    ['частиною назви', 'клавіат', 'name'],
    ['ПІБ власника', 'Левіс Артур', 'accountingOwnerResponsiblePerson'],
    ['ПІБ утримувача', 'Інший Утримувач', 'custodianResponsiblePerson'],
  ])('builds server-side search by %s', async (_label, search, expectedField) => {
    const { prisma, service: propertyService } = createService();
    await propertyService.list(query(MyPropertySection.ASSIGNED_TO_ME, `  ${search}  `), user);

    const call = prisma.custodyBalance.findMany.mock.calls[0][0];
    expect(JSON.stringify(call.where)).toContain(expectedField);
    expect(JSON.stringify(call.where)).toContain(search.split(' ')[0]);
  });

  it('scopes every section to the responsible person from the session', async () => {
    const { prisma, service: propertyService } = createService();
    await propertyService.list(query(MyPropertySection.DIRECT), user);
    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ responsiblePersonId: mvoId }),
    }));

    await propertyService.list(query(MyPropertySection.ASSIGNED_OUT), user);
    expect(prisma.custodyBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ accountingOwnerResponsiblePersonId: mvoId }),
    }));

    await propertyService.list(query(MyPropertySection.ASSIGNED_TO_ME), user);
    expect(prisma.custodyBalance.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ custodianResponsiblePersonId: mvoId }),
    }));
  });

  it('does not mix DIRECT, ASSIGNED_OUT and ASSIGNED_TO_ME responses', async () => {
    const direct = createService();
    expect((await direct.service.list(query(MyPropertySection.DIRECT), user)).items[0].section)
      .toBe(MyPropertySection.DIRECT);

    const assignedOut = createService();
    const out = await assignedOut.service.list(query(MyPropertySection.ASSIGNED_OUT), user);
    expect(out.items[0]).toMatchObject({ section: MyPropertySection.ASSIGNED_OUT, canAssign: false });

    const assignedToMe = createService();
    const held = await assignedToMe.service.list(query(MyPropertySection.ASSIGNED_TO_ME), user);
    expect(held.items[0]).toMatchObject({ section: MyPropertySection.ASSIGNED_TO_ME, canAssign: true });
  });

  it('caps page size at 100 and applies supported sorting', async () => {
    const { prisma, service: propertyService } = createService();
    await propertyService.list({
      ...query(MyPropertySection.DIRECT),
      limit: 999,
      sortBy: MyPropertySortBy.CODE,
      sortOrder: SortOrder.DESC,
    }, user);

    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 100,
      orderBy: [
        { inventoryItem: { externalCode: SortOrder.DESC } },
        { id: SortOrder.ASC },
      ],
    }));
  });

  it('uses the session link for every stock-read role and rejects a missing link', async () => {
    const { service: propertyService } = createService();
    await expect(propertyService.list(query(MyPropertySection.DIRECT), {
      ...user,
      role: UserRole.OWNER,
    })).resolves.toBeDefined();
    await expect(propertyService.list(query(MyPropertySection.DIRECT), {
      ...user,
      responsiblePersonId: null,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exports ALL with all three categories and no technical UUID fields', async () => {
    const { prisma, service: propertyService } = createService();
    prisma.stockBalance.findMany.mockResolvedValue([directRow]);
    prisma.custodyBalance.findMany.mockResolvedValue([custodyRow]);
    const exported = await propertyService.exportCsv({
      section: MyPropertyExportSection.ALL,
    } as ExportMyPropertyQueryDto, user);
    const csv = await streamText(exported.stream);

    expect(csv).toContain('Безпосередньо у мене');
    expect(csv).toContain('Закріплено за іншими');
    expect(csv).toContain('Закріплено за мною');
    expect(csv).not.toContain(itemId);
    expect(csv).not.toContain(directRow.id);
    expect(exported.filename).toMatch(/^mvo-property-002-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('exports only the selected tab when a concrete section is requested', async () => {
    const { prisma, service: propertyService } = createService();
    const exported = await propertyService.exportCsv({
      section: MyPropertyExportSection.ASSIGNED_TO_ME,
    } as ExportMyPropertyQueryDto, user);
    const csv = await streamText(exported.stream);

    expect(csv).toContain('Закріплено за мною');
    expect(csv).not.toContain('Безпосередньо у мене');
    expect(csv).not.toContain('Закріплено за іншими');
    expect(prisma.stockBalance.findMany).not.toHaveBeenCalled();
  });

  it('streams every export batch instead of limiting CSV to the first page', async () => {
    const { prisma, service: propertyService } = createService();
    const firstBatch = Array.from({ length: 500 }, (_, index) => ({
      ...directRow,
      id: `batch-${String(index).padStart(4, '0')}`,
      inventoryItem: { ...item, externalCode: `CODE-${index}` },
    }));
    prisma.stockBalance.findMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([{ ...directRow, id: 'batch-last', inventoryItem: { ...item, externalCode: 'CODE-500' } }]);
    const exported = await propertyService.exportCsv({
      section: MyPropertyExportSection.DIRECT,
    } as ExportMyPropertyQueryDto, user);
    const csv = await streamText(exported.stream);

    expect(csv).toContain('CODE-0');
    expect(csv).toContain('CODE-500');
    expect(prisma.stockBalance.findMany).toHaveBeenCalledTimes(2);
  });
});
