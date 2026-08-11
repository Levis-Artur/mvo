import { Prisma, StockDocumentStatus, UserRole } from '@prisma/client';
import { IssueHistoryService } from './issue-history.service';

const sourceId = '11111111-1111-4111-8111-111111111111';

const actor = (role: UserRole, responsiblePersonId: string | null = null) => ({
  id: '22222222-2222-4222-8222-222222222222',
  username: role.toLowerCase(),
  role,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId,
});

const issue = {
  id: '33333333-3333-4333-8333-333333333333',
  displayNumber: 12,
  documentDate: new Date('2026-08-10T00:00:00.000Z'),
  sourceResponsiblePersonId: sourceId,
  recipientName: 'Отримувач',
  note: 'Для підрозділу',
  status: StockDocumentStatus.POSTED,
  createdAt: new Date('2026-08-10T09:00:00.000Z'),
  sourceResponsiblePerson: {
    id: sourceId,
    personnelNumber: '57',
    externalAccountingCode: '0057',
    lastName: 'Жигульський',
    firstName: 'Андрій',
    middleName: 'Васильович',
  },
  createdByUser: {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'mvo-a',
    role: UserRole.MVO,
  },
  lines: [{ quantity: new Prisma.Decimal('2.5'), realizationLines: [] }],
  issueRealizations: [],
  attachments: [{ id: 'attachment-id' }],
};

function harness(items: unknown[] = [issue]) {
  const prisma = {
    stockDocument: {
      findMany: jest.fn().mockResolvedValue(items),
      count: jest.fn().mockResolvedValue(items.length),
    },
    securityEvent: { create: jest.fn() },
  };
  return { service: new IssueHistoryService(prisma as never), prisma };
}

describe('IssueHistoryService', () => {
  it('scopes MVO history to the responsible person from auth context', async () => {
    const h = harness();
    const result = await h.service.list(
      {
        page: 1,
        limit: 25,
        sourceResponsiblePersonId:
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
      actor(UserRole.MVO, sourceId),
    );

    const where = h.prisma.stockDocument.findMany.mock.calls[0][0].where;
    expect(where.sourceResponsiblePersonId).toBe(sourceId);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        displayNumber: 12,
        totalQuantity: '2.5',
        issuedQuantity: '2.5',
        realizedQuantity: '0',
        availableToRealize: '2.5',
        realizationCount: 0,
        isFullyRealized: false,
        numberOfLines: 1,
        hasAttachment: true,
        recipientName: 'Отримувач',
      }),
    );
  });

  it('allows a global read role to filter any MVO and uses inclusive dateTo', async () => {
    const h = harness([]);
    await h.service.list(
      {
        page: 2,
        limit: 50,
        sourceResponsiblePersonId: sourceId,
        dateTo: '2026-08-10',
        inventoryCode: 'KB',
        recipient: 'отрим',
        hasAttachment: true,
      },
      actor(UserRole.ACCOUNTANT),
    );

    const call = h.prisma.stockDocument.findMany.mock.calls[0][0];
    expect(call.skip).toBe(50);
    expect(call.take).toBe(50);
    expect(call.orderBy).toEqual([
      { documentDate: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(JSON.stringify(call.where)).toContain(
      '2026-08-10T23:59:59.999Z',
    );
    expect(call.where.sourceResponsiblePersonId).toBe(sourceId);
  });

  it('exports one safe CSV row per ISSUE line without changing stock', async () => {
    const exportIssue = {
      ...issue,
      lines: [
        {
          quantity: new Prisma.Decimal(2),
          realizationLines: [{ quantity: new Prisma.Decimal(1) }],
          inventoryItem: {
            externalCode: '=KB-1',
            name: 'Клавіатура',
            unitOfMeasure: 'шт.',
          },
        },
        {
          quantity: new Prisma.Decimal(3),
          realizationLines: [],
          inventoryItem: {
            externalCode: 'MS-1',
            name: 'Миша',
            unitOfMeasure: 'шт.',
          },
        },
      ],
      attachments: [{ originalFileName: 'накладна.pdf' }],
    };
    const h = harness([exportIssue]);

    const result = await h.service.exportCsv(
      { page: 1, limit: 25, status: StockDocumentStatus.POSTED },
      actor(UserRole.ACCOUNTANT),
      { requestId: 'issue-export-request' },
    );

    expect(result.csv.startsWith('\uFEFF')).toBe(true);
    expect(result.csv).toContain('"Видано"');
    expect(result.csv).toContain('"Реалізовано"');
    expect(result.csv).toContain('"Залишилося реалізувати"');
    expect(result.csv).toContain('"№ 12"');
    expect(result.csv).toContain("\"'=KB-1\"");
    expect(result.csv).toContain('"Отримувач"');
    expect(result.csv).toContain('"накладна.pdf"');
    expect(result.rowCount).toBe(2);
    expect(h.prisma.stockDocument.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        skip: expect.anything(),
        take: expect.anything(),
      }),
    );
    expect(h.prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'issue-export-request',
          success: true,
        }),
      }),
    );
    expect(h.prisma).not.toHaveProperty('stockBalance');
  });

  it('reports a fully realized ISSUE from active realization lines only', async () => {
    const h = harness([
      {
        ...issue,
        lines: [
          {
            quantity: new Prisma.Decimal('2.5'),
            realizationLines: [{ quantity: new Prisma.Decimal('2.5') }],
          },
        ],
        issueRealizations: [{ id: 'realization-1' }],
      },
    ]);

    const result = await h.service.list(
      { page: 1, limit: 25 },
      actor(UserRole.MVO, sourceId),
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        issuedQuantity: '2.5',
        realizedQuantity: '2.5',
        availableToRealize: '0',
        realizationCount: 1,
        isFullyRealized: true,
      }),
    );
  });
});
