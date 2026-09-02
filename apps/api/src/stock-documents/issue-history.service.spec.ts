import { Prisma, StockDocumentStatus, UserRole } from '@prisma/client';
import { IssueHistoryService } from './issue-history.service';

const sourceId = '11111111-1111-4111-8111-111111111111';

const actor = (
  role: UserRole,
  responsiblePersonId: string | null = null,
  accessScopes: Array<{
    managementId: string | null;
    serviceCode: string | null;
  }> = [],
) => ({
  id: '22222222-2222-4222-8222-222222222222',
  username: role.toLowerCase(),
  role,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId,
  accessScopes,
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
    expect(where.AND[0]).toEqual({
      OR: [{ sourceResponsiblePersonId: sourceId }],
    });
    expect(where.AND[1].sourceResponsiblePersonId).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
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
    expect(call.where.AND[0]).toEqual({});
    expect(call.where.AND[1].sourceResponsiblePersonId).toBe(sourceId);
  });

  it('scopes ISSUE history to the manager source MVO', async () => {
    const h = harness([]);
    const managementId = '44444444-4444-4444-8444-444444444444';

    await h.service.list(
      { page: 1, limit: 25 },
      actor(UserRole.ORG_MANAGER, null, [
        { managementId, serviceCode: 'IT' },
      ]),
    );

    expect(h.prisma.stockDocument.findMany.mock.calls[0][0].where.AND[0]).toEqual({
      OR: [
        {
          sourceResponsiblePerson: {
            OR: [{ managementId, service: { code: 'IT' } }],
          },
        },
        {
          destinationResponsiblePerson: {
            OR: [{ managementId, service: { code: 'IT' } }],
          },
        },
      ],
    });
    expect(h.prisma.stockDocument.findMany.mock.calls[0][0].where.AND[1].type).toBe(
      'ISSUE',
    );
  });

  it('exports one safe CSV row per ISSUE and realization line without changing stock', async () => {
    const exportIssue = {
      ...issue,
      lines: [
        {
          quantity: new Prisma.Decimal(2),
          realizationLines: [
            {
              quantity: new Prisma.Decimal(1),
              realization: {
                displayNumber: 1,
                realizationDate: new Date('2026-08-11T00:00:00.000Z'),
                recipientText: 'Підрозділ 1',
                note: 'Перша реалізація',
                status: 'POSTED',
                createdAt: new Date('2026-08-11T09:00:00.000Z'),
                attachments: [
                  { originalFileName: 'акт-реалізації.pdf' },
                ],
                createdByUser: { username: 'mvo-a' },
              },
            },
            {
              quantity: new Prisma.Decimal('0.5'),
              realization: {
                displayNumber: 2,
                realizationDate: new Date('2026-08-12T00:00:00.000Z'),
                recipientText: 'Підрозділ 2',
                note: 'Скасована реалізація',
                status: 'CANCELLED',
                createdAt: new Date('2026-08-12T09:00:00.000Z'),
                attachments: [],
                createdByUser: { username: 'mvo-b' },
              },
            },
          ],
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
    expect(result.csv).toContain('"Реалізовано всього"');
    expect(result.csv).toContain('"Залишилось нереалізовано"');
    expect(result.csv).toContain('"№ реалізації"');
    expect(result.csv).toContain('"№ 12"');
    expect(result.csv).toContain("\"'=KB-1\"");
    expect(result.csv).toContain('"Отримувач"');
    expect(result.csv).toContain('"накладна.pdf"');
    expect(result.csv).toContain('"акт-реалізації.pdf"');
    expect(result.csv).toContain('"Скасована реалізація"');
    expect(result.csv).toContain('"Скасовано"');
    expect(result.csv).toContain(
      '"шт.";"2";"1";"1";"№ 2"',
    );
    expect(result.csv).toContain(
      '"шт.";"3";"0";"3";"";"";"";"0"',
    );
    expect(result.rowCount).toBe(3);
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
