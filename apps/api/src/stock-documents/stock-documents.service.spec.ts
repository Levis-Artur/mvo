import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  StockDocumentStatus,
  StockDocumentType,
  StockSourceKind,
  StockTransactionType,
  UserRole,
  Prisma,
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

function document(
  type: StockDocumentType = StockDocumentType.TRANSFER,
  status: StockDocumentStatus = StockDocumentStatus.DRAFT,
) {
  return {
    id: 'document-id',
    documentNumber: 'MOV-1',
    documentDate: new Date(),
    type,
    status,
    sourceResponsiblePersonId: sourceId,
    destinationResponsiblePersonId:
      type === StockDocumentType.TRANSFER ? destinationId : null,
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
        quantity: new Prisma.Decimal(2),
        note: null,
        createdAt: new Date(),
        inventoryItem: { id: itemId },
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
    },
    stockDocumentLine: { deleteMany: jest.fn() },
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

describe('StockDocumentsService', () => {
  it('does not route ASSIGNMENT through the legacy TRANSFER or ISSUE logic', async () => {
    const { service, prisma, stock } = createService();

    await expect(
      service.create(
        {
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
        },
        owner,
        {},
      ),
    ).rejects.toThrow('custody-сервісу');
    expect(prisma.stockDocument.create).not.toHaveBeenCalled();
    expect(stock.createDecreasingTransactionInTx).not.toHaveBeenCalled();
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('posts a transfer with matching out and in transactions', async () => {
    const { service, prisma, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(document());
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.TRANSFER, StockDocumentStatus.POSTED),
    );

    await service.post('document-id', owner, { requestId: 'request-1' });

    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.TRANSFER_OUT,
        responsiblePersonId: sourceId,
        documentId: 'document-id',
        documentLineId: 'line-id',
      }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.TRANSFER_IN,
        responsiblePersonId: destinationId,
      }),
    );
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

  it('relies on decreasing transaction validation for insufficient stock', async () => {
    const { service, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(document());
    stock.createDecreasingTransactionInTx.mockRejectedValue(
      new BadRequestException('Недостатній залишок'),
    );
    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'Недостатній залишок',
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('rolls back the whole posting transaction when one line fails', async () => {
    const { service, prisma } = createService();
    prisma.$transaction.mockRejectedValue(new Error('line failed'));
    await expect(service.post('document-id', owner, {})).rejects.toThrow(
      'line failed',
    );
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      }),
    );
  });

  it('posts an issue with one decreasing transaction', async () => {
    const { service, prisma, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE),
    );
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE, StockDocumentStatus.POSTED),
    );
    await service.post('document-id', owner, {});
    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ type: StockTransactionType.ISSUE }),
    );
    expect(stock.createIncreasingTransactionInTx).not.toHaveBeenCalled();
  });

  it('does not post the same document twice', async () => {
    const { service, tx } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.TRANSFER, StockDocumentStatus.POSTED),
    );
    await expect(service.post('document-id', owner, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancels a transfer with reverse transactions', async () => {
    const { service, prisma, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.TRANSFER, StockDocumentStatus.POSTED),
    );
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.TRANSFER, StockDocumentStatus.CANCELLED),
    );
    await service.cancel('document-id', owner, {});
    expect(stock.createDecreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.TRANSFER_REVERSAL_OUT,
        responsiblePersonId: destinationId,
      }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.TRANSFER_REVERSAL_IN,
        responsiblePersonId: sourceId,
      }),
    );
  });

  it('cancels an issue by restoring source stock', async () => {
    const { service, prisma, tx, stock } = createService();
    tx.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE, StockDocumentStatus.POSTED),
    );
    prisma.stockDocument.findUnique.mockResolvedValue(
      document(StockDocumentType.ISSUE, StockDocumentStatus.CANCELLED),
    );
    await service.cancel('document-id', owner, {});
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        type: StockTransactionType.ISSUE_REVERSAL,
        responsiblePersonId: sourceId,
      }),
    );
  });

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

  it('prevents AUDITOR from creating or posting documents', async () => {
    const { service } = createService();
    await expect(
      service.create(
        transferDto,
        { ...owner, role: UserRole.AUDITOR },
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

  it('prevents deleting a posted document and permits deleting a draft', async () => {
    const { service, prisma } = createService();
    prisma.stockDocument.findUnique
      .mockResolvedValueOnce(
        document(StockDocumentType.TRANSFER, StockDocumentStatus.POSTED),
      )
      .mockResolvedValueOnce(document());
    await expect(
      service.remove('document-id', owner, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove('document-id', owner, {})).resolves.toEqual({
      deleted: true,
      id: 'document-id',
    });
  });
});
