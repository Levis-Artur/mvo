import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
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
};
const transferRow = {
  id: '66666666-6666-4666-8666-666666666666',
  quantity: new Prisma.Decimal('2.2500'),
  inventoryItem: item,
  document: {
    id: '77777777-7777-4777-8777-777777777777',
    displayNumber: 7,
    documentDate: new Date('2026-07-20T11:00:00.000Z'),
    type: StockDocumentType.ASSIGNMENT,
    status: StockDocumentStatus.POSTED,
    destinationResponsiblePerson: {
      id: otherId,
      lastName: 'Інший',
      firstName: 'Одержувач',
      middleName: null,
      personnelNumber: '003',
    },
  },
};

function createService() {
  const prisma = {
    stockBalance: {
      findMany: jest.fn().mockResolvedValue([directRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    stockDocumentLine: {
      findMany: jest.fn().mockResolvedValue([transferRow]),
      count: jest.fn().mockResolvedValue(1),
    },
    responsiblePerson: {
      findUnique: jest.fn().mockResolvedValue({ personnelNumber: '002' }),
    },
  };
  return { prisma, service: new MyPropertyService(prisma as never) };
}

function query(
  section: MyPropertySection,
  search?: string,
): ListMyPropertyQueryDto {
  return {
    section,
    search,
    page: 1,
    limit: 20,
    sortBy:
      section === MyPropertySection.TRANSFERRED
        ? MyPropertySortBy.DOCUMENT_DATE
        : MyPropertySortBy.NAME,
    sortOrder:
      section === MyPropertySection.TRANSFERRED
        ? SortOrder.DESC
        : SortOrder.ASC,
  };
}

async function streamText(stream: NodeJS.ReadableStream) {
  let result = '';
  for await (const chunk of stream) result += chunk.toString();
  return result;
}

describe('MyPropertyService', () => {
  it('returns only positive direct StockBalance rows for the current MVO', async () => {
    const { prisma, service } = createService();

    const result = await service.list(query(MyPropertySection.DIRECT), user);

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        section: MyPropertySection.DIRECT,
        id: directRow.id,
        quantity: '4.5',
      }),
    );
    expect(result).not.toHaveProperty('summary');
    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          responsiblePersonId: mvoId,
          quantity: { gt: 0 },
        }),
      }),
    );
  });

  it('builds transferred history from document lines rather than custody balances', async () => {
    const { prisma, service } = createService();

    const result = await service.list(
      query(MyPropertySection.TRANSFERRED),
      user,
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        section: MyPropertySection.TRANSFERRED,
        id: transferRow.id,
        recipient: expect.objectContaining({
          id: otherId,
          fullName: 'Інший Одержувач',
        }),
        document: expect.objectContaining({
          displayNumber: 7,
          status: StockDocumentStatus.POSTED,
        }),
      }),
    );
    expect(prisma.stockDocumentLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          document: expect.objectContaining({
            sourceResponsiblePersonId: mvoId,
            type: {
              in: [
                StockDocumentType.TRANSFER,
                StockDocumentType.ASSIGNMENT,
                StockDocumentType.MVO_TRANSFER,
              ],
            },
            status: {
              in: [
                StockDocumentStatus.DRAFT,
                StockDocumentStatus.POSTED,
                StockDocumentStatus.CANCELLED,
              ],
            },
          }),
        }),
      }),
    );
    expect(prisma).not.toHaveProperty('custodyBalance');
  });

  it('searches transfer history by item, document, and recipient fields', async () => {
    const { prisma, service } = createService();

    await service.list(
      query(MyPropertySection.TRANSFERRED, '  Інший 7  '),
      user,
    );

    const where = prisma.stockDocumentLine.findMany.mock.calls[0][0].where;
    const serialized = JSON.stringify(where);
    expect(serialized).toContain('inventoryItem');
    expect(serialized).toContain('documentNumber');
    expect(serialized).toContain('destinationResponsiblePerson');
    expect(serialized).toContain('displayNumber');
  });

  it('caps page size at 100 and applies supported direct sorting', async () => {
    const { prisma, service } = createService();
    await service.list(
      {
        ...query(MyPropertySection.DIRECT),
        limit: 999,
        sortBy: MyPropertySortBy.CODE,
        sortOrder: SortOrder.DESC,
      },
      user,
    );

    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        orderBy: [
          { inventoryItem: { externalCode: SortOrder.DESC } },
          { id: SortOrder.ASC },
        ],
      }),
    );
  });

  it('uses the responsible person link from the session', async () => {
    const { service } = createService();
    await expect(
      service.list(query(MyPropertySection.DIRECT), {
        ...user,
        role: UserRole.OWNER,
      }),
    ).resolves.toBeDefined();
    await expect(
      service.list(query(MyPropertySection.DIRECT), {
        ...user,
        responsiblePersonId: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exports direct balances and transfer-document history without UUIDs', async () => {
    const { service } = createService();
    const exported = await service.exportCsv(
      { section: MyPropertyExportSection.ALL } as ExportMyPropertyQueryDto,
      user,
    );
    const csv = await streamText(exported.stream);

    expect(csv).toContain('У мене');
    expect(csv).toContain('Передано іншим МВО');
    expect(csv).toContain('Інший Одержувач');
    expect(csv).not.toContain(itemId);
    expect(csv).not.toContain(directRow.id);
    expect(exported.filename).toMatch(
      /^mvo-property-002-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });

  it('exports only transfer history for the transferred tab', async () => {
    const { prisma, service } = createService();
    const exported = await service.exportCsv(
      {
        section: MyPropertyExportSection.TRANSFERRED,
      } as ExportMyPropertyQueryDto,
      user,
    );
    const csv = await streamText(exported.stream);

    expect(csv).toContain('Передано іншим МВО');
    expect(csv).not.toContain('"У мене"');
    expect(prisma.stockBalance.findMany).not.toHaveBeenCalled();
  });

  it('streams all direct export batches', async () => {
    const { prisma, service } = createService();
    const firstBatch = Array.from({ length: 500 }, (_, index) => ({
      ...directRow,
      id: `batch-${String(index).padStart(4, '0')}`,
      inventoryItem: { ...item, externalCode: `CODE-${index}` },
    }));
    prisma.stockBalance.findMany
      .mockResolvedValueOnce(firstBatch)
      .mockResolvedValueOnce([
        {
          ...directRow,
          id: 'batch-last',
          inventoryItem: { ...item, externalCode: 'CODE-500' },
        },
      ]);
    const exported = await service.exportCsv(
      {
        section: MyPropertyExportSection.DIRECT,
      } as ExportMyPropertyQueryDto,
      user,
    );
    const csv = await streamText(exported.stream);

    expect(csv).toContain('CODE-0');
    expect(csv).toContain('CODE-500');
    expect(prisma.stockBalance.findMany).toHaveBeenCalledTimes(2);
  });
});
