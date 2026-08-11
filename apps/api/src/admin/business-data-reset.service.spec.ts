import {
  SecurityEventType,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import {
  BUSINESS_DATA_RESET_REFUSAL,
  BusinessDataResetRefusedError,
  BusinessDataResetService,
  formatBusinessDataResetReport,
} from './business-data-reset.service';

type BusinessState = {
  inventoryItems: number;
  stockBalances: number;
  custodyBalances: number;
  stockDocuments: number;
  mvoTransfers: number;
  issues: number;
  childIssues: number;
  legacyIssues: number;
  legacyDocuments: number;
  stockDocumentLines: number;
  attachments: number;
  stockTransactions: number;
  importBatches: number;
  importRows: number;
  accountingExportBatches: number;
  accountingExportBatchDocuments: number;
  accountingExportRows: number;
  businessAuditEvents: number;
};

function harness() {
  const state: BusinessState = {
    inventoryItems: 4,
    stockBalances: 3,
    custodyBalances: 2,
    stockDocuments: 5,
    mvoTransfers: 1,
    issues: 2,
    childIssues: 1,
    legacyIssues: 1,
    legacyDocuments: 2,
    stockDocumentLines: 6,
    attachments: 2,
    stockTransactions: 8,
    importBatches: 1,
    importRows: 4,
    accountingExportBatches: 1,
    accountingExportBatchDocuments: 1,
    accountingExportRows: 2,
    businessAuditEvents: 3,
  };
  const deleteCount = (key: keyof BusinessState) =>
    jest.fn(async () => {
      const count = state[key];
      state[key] = 0;
      return { count };
    });
  const simpleCount = (key: keyof BusinessState) =>
    jest.fn(async () => state[key]);

  const tx = {
    user: {
      count: jest.fn(async (args?: { where?: { role?: UserRole } }) =>
        args?.where?.role === UserRole.ACCOUNTANT
          ? 1
          : args?.where?.role === UserRole.OWNER
            ? 1
            : 5,
      ),
    },
    userSession: { count: jest.fn().mockResolvedValue(4) },
    responsiblePerson: {
      count: jest.fn(
        async (args?: {
          where?: { externalAccountingCode?: { not: null } };
        }) => (args?.where?.externalAccountingCode ? 3 : 4),
      ),
    },
    management: { count: jest.fn().mockResolvedValue(1) },
    service: { count: jest.fn().mockResolvedValue(2) },
    unit: { count: jest.fn().mockResolvedValue(3) },
    inventoryItem: {
      count: simpleCount('inventoryItems'),
      deleteMany: deleteCount('inventoryItems'),
    },
    stockBalance: {
      count: simpleCount('stockBalances'),
      deleteMany: deleteCount('stockBalances'),
    },
    custodyBalance: {
      count: simpleCount('custodyBalances'),
      deleteMany: deleteCount('custodyBalances'),
    },
    stockDocument: {
      count: jest.fn(
        async (args?: {
          where?: {
            type?: StockDocumentType | { in: StockDocumentType[] };
            sourceTransferId?: null | { not: null };
          };
        }) => {
          const type = args?.where?.type;
          if (type === StockDocumentType.MVO_TRANSFER) return state.mvoTransfers;
          if (type === StockDocumentType.ISSUE) {
            if (args?.where?.sourceTransferId === null) return state.legacyIssues;
            if (args?.where?.sourceTransferId) return state.childIssues;
            return state.issues;
          }
          if (typeof type === 'object') return state.legacyDocuments;
          return state.stockDocuments;
        },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: jest.fn(async () => {
        const count = state.stockDocuments;
        state.stockDocuments = 0;
        state.mvoTransfers = 0;
        state.issues = 0;
        state.childIssues = 0;
        state.legacyIssues = 0;
        state.legacyDocuments = 0;
        return { count };
      }),
    },
    stockDocumentLine: {
      count: simpleCount('stockDocumentLines'),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: deleteCount('stockDocumentLines'),
    },
    stockDocumentAttachment: {
      count: simpleCount('attachments'),
      findMany: jest.fn(async () =>
        state.attachments
          ? [
              { storagePath: 'attachment-a.pdf' },
              { storagePath: 'attachment-b.jpg' },
            ]
          : [],
      ),
      deleteMany: deleteCount('attachments'),
    },
    issueRealizationAttachment: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    issueRealizationLine: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    issueRealization: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    stockTransaction: {
      count: simpleCount('stockTransactions'),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: deleteCount('stockTransactions'),
    },
    importBatch: {
      count: simpleCount('importBatches'),
      deleteMany: deleteCount('importBatches'),
    },
    importRow: {
      count: simpleCount('importRows'),
      deleteMany: deleteCount('importRows'),
    },
    accountingTransferExportBatch: {
      count: simpleCount('accountingExportBatches'),
      deleteMany: deleteCount('accountingExportBatches'),
    },
    accountingTransferExportBatchDocument: {
      count: simpleCount('accountingExportBatchDocuments'),
      deleteMany: deleteCount('accountingExportBatchDocuments'),
    },
    accountingTransferExportRow: {
      count: simpleCount('accountingExportRows'),
      deleteMany: deleteCount('accountingExportRows'),
    },
    securityEvent: {
      count: jest.fn(
        async (args?: {
          where?: {
            type?: {
              in?: SecurityEventType[];
              notIn?: SecurityEventType[];
            };
          };
        }) => (args?.where?.type?.in ? state.businessAuditEvents : 7),
      ),
      deleteMany: deleteCount('businessAuditEvents'),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ setval: 1 }]),
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (
      callback: (client: typeof tx) => Promise<unknown>,
    ) => {
      const snapshot = { ...state };
      try {
        return await callback(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    }),
  };
  const storage = {
    stageForDeletion: jest.fn(async (storagePath: string) => ({
      storagePath,
      stagedStoragePath: `.deleting-${storagePath}`,
    })),
    restoreStaged: jest.fn().mockResolvedValue(undefined),
    finalizeDeletion: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new BusinessDataResetService(prisma as never, storage as never),
    prisma,
    tx,
    storage,
    state,
  };
}

describe('BusinessDataResetService', () => {
  it('refuses before querying or mutating when the explicit flag is absent', async () => {
    const { service, prisma, storage } = harness();

    await expect(service.run({ allowedFlag: 'NO' })).rejects.toEqual(
      new BusinessDataResetRefusedError(),
    );
    expect(BUSINESS_DATA_RESET_REFUSAL).toBe(
      'REFUSED: set ALLOW_BUSINESS_DATA_RESET=YES',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
  });

  it('reports a dry run while preserving users, roles, MVO codes and structure', async () => {
    const { service, prisma, tx, storage } = harness();

    const report = await service.run({ allowedFlag: 'YES', dryRun: true });

    expect(report.preserved).toMatchObject({
      users: 5,
      accountantUsers: 1,
      ownerUsers: 1,
      userSessions: 4,
      responsiblePersons: 4,
      responsiblePersonsWithAccountingCode: 3,
      managements: 1,
      services: 2,
      units: 3,
    });
    expect(report.deleteCandidates).toMatchObject({
      inventoryItems: 4,
      stockBalances: 3,
      mvoTransfers: 1,
      issues: 2,
      childIssues: 1,
      legacyIssues: 1,
      attachments: 2,
      importBatches: 1,
      accountingExportBatches: 1,
      stockTransactions: 8,
    });
    expect(report.deleted).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.inventoryItem.deleteMany).not.toHaveBeenCalled();
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
    expect(formatBusinessDataResetReport(report)).toContain(
      '=== DRY RUN: NOTHING WILL BE DELETED ===',
    );
  });

  it('deletes every business model in FK-safe order and preserves identities', async () => {
    const { service, tx, storage } = harness();

    const report = await service.run({ allowedFlag: 'YES' });

    expect(report.currentBusinessState).toEqual(
      expect.objectContaining(
        Object.fromEntries(
          Object.keys(report.deleteCandidates).map((key) => [key, 0]),
        ),
      ),
    );
    expect(report.preserved).toMatchObject({
      users: 5,
      accountantUsers: 1,
      ownerUsers: 1,
      responsiblePersons: 4,
      responsiblePersonsWithAccountingCode: 3,
      managements: 1,
      services: 2,
      units: 3,
    });
    expect(tx.stockTransaction.updateMany).toHaveBeenCalledWith({
      where: { reversalOfTransactionId: { not: null } },
      data: { reversalOfTransactionId: null },
    });
    expect(tx.stockDocumentLine.updateMany).toHaveBeenCalledWith({
      where: { sourceTransferLineId: { not: null } },
      data: { sourceTransferLineId: null },
    });
    expect(tx.stockDocument.updateMany).toHaveBeenCalledWith({
      where: { sourceTransferId: { not: null } },
      data: { sourceTransferId: null },
    });
    expect(tx.accountingTransferExportRow.deleteMany).toHaveBeenCalled();
    expect(tx.accountingTransferExportBatchDocument.deleteMany).toHaveBeenCalled();
    expect(tx.accountingTransferExportBatch.deleteMany).toHaveBeenCalled();
    expect(tx.stockDocumentAttachment.deleteMany).toHaveBeenCalled();
    expect(tx.issueRealizationAttachment.deleteMany).toHaveBeenCalled();
    expect(tx.issueRealizationLine.deleteMany).toHaveBeenCalled();
    expect(tx.issueRealization.deleteMany).toHaveBeenCalled();
    expect(tx.stockTransaction.deleteMany).toHaveBeenCalled();
    expect(tx.stockDocumentLine.deleteMany).toHaveBeenCalled();
    expect(tx.stockDocument.deleteMany).toHaveBeenCalled();
    expect(tx.stockBalance.deleteMany).toHaveBeenCalled();
    expect(tx.custodyBalance.deleteMany).toHaveBeenCalled();
    expect(tx.importRow.deleteMany).toHaveBeenCalled();
    expect(tx.importBatch.deleteMany).toHaveBeenCalled();
    expect(tx.inventoryItem.deleteMany).toHaveBeenCalled();
    expect(tx.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        type: {
          in: [
            SecurityEventType.STOCK_DOCUMENT_ACTION,
            SecurityEventType.IMPORT_ACTION,
          ],
        },
      },
    });
    expect(tx.user).not.toHaveProperty('deleteMany');
    expect(tx.responsiblePerson).not.toHaveProperty('deleteMany');
    expect(tx.management).not.toHaveProperty('deleteMany');
    expect(tx.service).not.toHaveProperty('deleteMany');
    expect(tx.unit).not.toHaveProperty('deleteMany');
    expect(storage.stageForDeletion).toHaveBeenCalledTimes(2);
    expect(storage.finalizeDeletion).toHaveBeenCalledWith([
      {
        storagePath: 'attachment-a.pdf',
        stagedStoragePath: '.deleting-attachment-a.pdf',
      },
      {
        storagePath: 'attachment-b.jpg',
        stagedStoragePath: '.deleting-attachment-b.jpg',
      },
    ]);
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining(
        'ALTER SEQUENCE "StockDocument_displayNumber_seq" RESTART WITH 1',
      ),
    );

    const attachmentDeleteOrder =
      tx.stockDocumentAttachment.deleteMany.mock.invocationCallOrder[0];
    const transactionDeleteOrder =
      tx.stockTransaction.deleteMany.mock.invocationCallOrder[0];
    const lineDeleteOrder =
      tx.stockDocumentLine.deleteMany.mock.invocationCallOrder[0];
    const documentDeleteOrder =
      tx.stockDocument.deleteMany.mock.invocationCallOrder[0];
    const balanceDeleteOrder =
      tx.stockBalance.deleteMany.mock.invocationCallOrder[0];
    const itemDeleteOrder =
      tx.inventoryItem.deleteMany.mock.invocationCallOrder[0];
    expect(attachmentDeleteOrder).toBeLessThan(documentDeleteOrder);
    expect(transactionDeleteOrder).toBeLessThan(lineDeleteOrder);
    expect(lineDeleteOrder).toBeLessThan(documentDeleteOrder);
    expect(documentDeleteOrder).toBeLessThan(balanceDeleteOrder);
    expect(balanceDeleteOrder).toBeLessThan(itemDeleteOrder);
  });

  it('is idempotent when the business state is already empty', async () => {
    const { service, storage } = harness();

    await service.run({ allowedFlag: 'YES' });
    const second = await service.run({ allowedFlag: 'YES' });

    expect(second.deleteCandidates).toEqual(
      expect.objectContaining({
        inventoryItems: 0,
        stockBalances: 0,
        stockDocuments: 0,
        importBatches: 0,
        accountingExportBatches: 0,
      }),
    );
    expect(second.currentBusinessState).toEqual(second.deleteCandidates);
    expect(storage.stageForDeletion).toHaveBeenCalledTimes(2);
  });

  it('restores staged files when the database transaction fails', async () => {
    const { service, tx, storage, state } = harness();
    const stateBefore = { ...state };
    tx.stockDocument.deleteMany.mockRejectedValueOnce(new Error('FK failure'));

    await expect(service.run({ allowedFlag: 'YES' })).rejects.toThrow(
      'FK failure',
    );
    expect(storage.restoreStaged).toHaveBeenCalledWith([
      {
        storagePath: 'attachment-a.pdf',
        stagedStoragePath: '.deleting-attachment-a.pdf',
      },
      {
        storagePath: 'attachment-b.jpg',
        stagedStoragePath: '.deleting-attachment-b.jpg',
      },
    ]);
    expect(storage.finalizeDeletion).not.toHaveBeenCalled();
    expect(state).toEqual(stateBefore);
  });
});
