import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  Prisma,
  StockAccountingModel,
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
} from '@prisma/client';
import { StockDocumentsService } from './stock-documents.service';

const owner = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'owner',
  role: UserRole.OWNER,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};
const sourceId = '22222222-2222-2222-2222-222222222222';
const destinationId = '33333333-3333-3333-3333-333333333333';
const itemId = '44444444-4444-4444-4444-444444444444';
const accountingOwnerId = '55555555-5555-5555-5555-555555555555';
const custodyBalanceId = '66666666-6666-6666-6666-666666666666';

function document(
  type: StockDocumentType = StockDocumentType.TRANSFER,
  status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  sourceKind?: StockSourceKind,
) {
  const accountingModel =
    type === StockDocumentType.ASSIGNMENT
      ? StockAccountingModel.OWNER_CUSTODY
      : StockAccountingModel.LEGACY_BALANCE;
  const lineOwnerId =
    sourceKind === StockSourceKind.ASSIGNED ? accountingOwnerId : sourceId;
  const transactions =
    type === StockDocumentType.ASSIGNMENT && status === StockDocumentStatus.POSTED
      ? [
          {
            id: 'outgoing-transaction-id',
            type:
              sourceKind === StockSourceKind.ASSIGNED
                ? StockTransactionType.ASSIGNMENT_OUT_CUSTODY
                : StockTransactionType.ASSIGNMENT_OUT_DIRECT,
          },
          {
            id: 'incoming-transaction-id',
            type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
          },
        ]
      : [];
  return {
    id: 'document-id',
    documentNumber: 'MOV-1',
    documentDate: new Date(),
    type,
    accountingModel,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId:
      type === StockDocumentType.TRANSFER ||
      type === StockDocumentType.ASSIGNMENT
        ? destinationId
        : null,
    recipientName: type === StockDocumentType.ISSUE ? 'Одержувач' : null,
    recipientUnit: null,
    basis: null,
    note: null,
    createdByUserId: owner.id,
    postedByUserId: null,
    postedAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'line-id',
        documentId: 'document-id',
        inventoryItemId: itemId,
        sourceKind: sourceKind ?? null,
        accountingOwnerResponsiblePersonId: sourceKind ? lineOwnerId : null,
        sourceCustodianResponsiblePersonId:
          sourceKind === StockSourceKind.ASSIGNED ? sourceId : null,
        sourceCustodyBalanceId:
          sourceKind === StockSourceKind.ASSIGNED ? custodyBalanceId : null,
        quantity: new Prisma.Decimal(2),
        note: null,
        createdAt: new Date(),
        inventoryItem: { id: itemId },
        accountingOwnerResponsiblePerson: null,
        sourceCustodianResponsiblePerson: null,
        sourceCustodyBalance: null,
        transactions,
      },
    ],
    sourceResponsiblePerson: { id: sourceId },
    destinationResponsiblePerson: { id: destinationId },
    createdByUser: { id: owner.id, username: 'owner', role: UserRole.OWNER },
    postedByUser: null,
    cancelledByUser: null,
  };
}

function createService() {
  const tx = {
    stockDocument: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    stockDocumentLine: { deleteMany: jest.fn() },
    custodyBalance: { findUnique: jest.fn() },
    securityEvent: { create: jest.fn() },
  };
  const prisma = {
    stockDocument: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    securityEvent: { create: jest.fn() },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const stock = {
    createDecreasingTransactionInTx: jest.fn(),
    createIncreasingTransactionInTx: jest.fn(),
    createCustodyDecreasingTransactionInTx: jest.fn(),
    createCustodyIncreasingTransactionInTx: jest.fn(),
  };
  return {
    service: new StockDocumentsService(prisma as never, stock as never),
    prisma,
    tx,
    stock,
  };
}

const transferDto = {
  documentDate: new Date().toISOString(),
  type: StockDocumentType.TRANSFER,
  sourceResponsiblePersonId: sourceId,
  destinationResponsiblePersonId: destinationId,
  lines: [{ inventoryItemId: itemId, quantity: '2' }],
};

function preparePostedResult(
  prisma: ReturnType<typeof createService>['prisma'],
  value: ReturnType<typeof document>,
) {
  prisma.stockDocument.findUnique.mockResolvedValue({
    ...value,
    status: StockDocumentStatus.POSTED,
  });
}

describe('StockDocumentsService', () => {
  it('creates and edits an ASSIGNMENT draft with explicit source metadata', async () => {
    const { service, prisma, tx } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    const dto = {
      ...transferDto,
      type: StockDocumentType.ASSIGNMENT,
      lines: [
        {
          inventoryItemId: itemId,
          quantity: '2',
          sourceKind: StockSourceKind.DIRECT,
          accountingOwnerResponsiblePersonId: sourceId,
        },
      ],
    };
    prisma.stockDocument.create.mockResolvedValue(value);

    await service.create(dto, owner, {});

    expect(prisma.stockDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountingModel: StockAccountingModel.OWNER_CUSTODY,
          lines: {
            create: [
              expect.objectContaining({
                sourceKind: StockSourceKind.DIRECT,
                accountingOwnerResponsiblePersonId: sourceId,
              }),
            ],
          },
        }),
      }),
    );

    prisma.stockDocument.findUnique.mockResolvedValue(value);
    tx.stockDocument.update.mockResolvedValue(value);
    await expect(
      service.update('document-id', dto, owner, {}),
    ).resolves.toBeDefined();
    expect(tx.stockDocumentLine.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'document-id' },
    });
  });

  it('posts DIRECT to CUSTODY without increasing recipient StockBalance', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, { requestId: 'request-1' });

    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_OUT_DIRECT,
        responsiblePersonId: sourceId,
        accountingOwnerResponsiblePersonId: sourceId,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_IN_CUSTODY,
        accountingOwnerResponsiblePersonId: sourceId,
        custodianResponsiblePersonId: destinationId,
      }),
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts CUSTODY to CUSTODY and keeps the accounting owner', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.ASSIGNED,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    tx.custodyBalance.findUnique.mockResolvedValue({
      inventoryItemId: itemId,
      accountingOwnerResponsiblePersonId: accountingOwnerId,
      custodianResponsiblePersonId: sourceId,
    });
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        custodianResponsiblePersonId: sourceId,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        custodianResponsiblePersonId: destinationId,
      }),
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('returns CUSTODY to the accounting owner DIRECT bucket', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.ASSIGNED,
    );
    value.destinationResponsiblePersonId = accountingOwnerId;
    tx.stockDocument.findUnique.mockResolvedValue(value);
    tx.custodyBalance.findUnique.mockResolvedValue({
      inventoryItemId: itemId,
      accountingOwnerResponsiblePersonId: accountingOwnerId,
      custodianResponsiblePersonId: sourceId,
    });
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalled();
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_IN_DIRECT,
        responsiblePersonId: accountingOwnerId,
        accountingOwnerResponsiblePersonId: accountingOwnerId,
        bucketKind: StockSourceKind.DIRECT,
      }),
    );
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rejects transfer to the same MVO', async () => {
    const { service } = createService();
    await expect(
      service.create(
        { ...transferDto, destinationResponsiblePersonId: sourceId },
        owner,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an ASSIGNED source held by another MVO', async () => {
    const { service } = createService();
    await expect(
      service.create(
        {
          ...transferDto,
          type: StockDocumentType.ASSIGNMENT,
          lines: [
            {
              inventoryItemId: itemId,
              quantity: '1',
              sourceKind: StockSourceKind.ASSIGNED,
              accountingOwnerResponsiblePersonId: accountingOwnerId,
              sourceCustodianResponsiblePersonId: destinationId,
            },
          ],
        },
        owner,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('propagates insufficient direct or custody quantity errors', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(
        StockDocumentType.ASSIGNMENT,
        StockDocumentStatus.DRAFT,
        StockSourceKind.DIRECT,
      ),
    );
    stock.createDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатній залишок'),
    );
    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'Недостатній залишок',
    );
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rolls back the whole posting transaction when one line fails', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.DRAFT,
      StockSourceKind.DIRECT,
    );
    value.lines.push({
      ...value.lines[0],
      id: 'line-id-2',
      inventoryItemId: '77777777-7777-7777-7777-777777777777',
    });
    tx.stockDocument.findUnique.mockResolvedValue(value);
    stock.createDecreasingTransactionInTx
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('line failed'));

    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'line failed',
    );
    expect(tx.stockDocument.update).not.toHaveBeenCalled();
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      }),
    );
  });

  it('keeps posting idempotent after the document is POSTED', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.POSTED,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.updateMany.mockResolvedValue({ count: 0 });
    tx.stockDocument.findUnique.mockResolvedValue({
      status: StockDocumentStatus.POSTED,
    });
    preparePostedResult(prisma, value);

    await expect(service.post('document-id', owner, {})).resolves.toBeDefined();
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(stock.createCustodyIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('reverses ASSIGNMENT only after taking quantity from the new custodian', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document(
      StockDocumentType.ASSIGNMENT,
      StockDocumentStatus.POSTED,
      StockSourceKind.DIRECT,
    );
    tx.stockDocument.findUnique.mockResolvedValue(value);
    prisma.stockDocument.findUnique.mockResolvedValue({
      ...value,
      status: StockDocumentStatus.CANCELLED,
    });

    await service.cancel('document-id', owner, {});

    expect(stock.createCustodyDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ASSIGNMENT_REVERSAL,
        custodianResponsiblePersonId: destinationId,
        reversalOfTransactionId: 'incoming-transaction-id',
      }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        responsiblePersonId: sourceId,
        reversalOfTransactionId: 'outgoing-transaction-id',
      }),
    );
  });

  it('does not complete cancellation when destination custody is insufficient', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(
        StockDocumentType.ASSIGNMENT,
        StockDocumentStatus.POSTED,
        StockSourceKind.DIRECT,
      ),
    );
    stock.createCustodyDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатньо закріпленого майна'),
    );

    await expect(service.cancel('document-id', owner, {})).rejects.toThrow(
      'Недостатньо закріпленого майна',
    );
    expect(tx.stockDocument.update).not.toHaveBeenCalled();
  });

  it('preserves legacy TRANSFER posting behavior', async () => {
    const { service, prisma, tx, stock } = createService();
    const value = document();
    tx.stockDocument.findUnique.mockResolvedValue(value);
    preparePostedResult(prisma, value);

    await service.post('document-id', owner, {});

    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: StockTransactionType.TRANSFER_OUT }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: StockTransactionType.TRANSFER_IN }),
    );
  });

  it.each([UserRole.ACCOUNTANT, UserRole.AUDITOR])(
    'keeps %s read-only for stock documents',
    async (role) => {
      const { service } = createService();
      await expect(
        service.create(transferDto, { ...owner, role }, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('prevents MVO from creating a document for another source', async () => {
    const { service } = createService();
    await expect(
      service.create(
        transferDto,
        { ...owner, role: UserRole.MVO, responsiblePersonId: destinationId },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents editing a posted document', async () => {
    const { service, prisma } = createService();
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.TRANSFER, StockDocumentStatus.POSTED),
    );
    await expect(
      service.update('document-id', transferDto, owner, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
