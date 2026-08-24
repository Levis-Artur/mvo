import { StockDocumentType, UserRole } from '@prisma/client';
import { ManagementsService } from '../managements/managements.service';
import {
  BUSINESS_DATA_RESET_REFUSAL,
  BusinessDataResetRefusedError,
  BusinessDataResetService,
  type BusinessDataCounts,
  formatBusinessDataResetReport,
} from './business-data-reset.service';

type ResetState = BusinessDataCounts;

const ownerRecord = {
  id: 'owner-id',
  username: 'owner',
  passwordHash: 'unchanged-password-hash',
  role: UserRole.OWNER,
  isActive: true,
};

function initialState(): ResetState {
  return {
    nonOwnerUsers: 4,
    userAccessScopes: 3,
    nonOwnerSessions: 2,
    responsiblePersons: 4,
    managements: 1,
    services: 3,
    units: 2,
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
    stockDocumentAttachments: 2,
    issueRealizations: 2,
    issueRealizationLines: 3,
    issueRealizationAttachments: 1,
    stockTransactions: 8,
    importBatches: 1,
    importRows: 4,
    accountingExportBatches: 1,
    accountingExportBatchDocuments: 1,
    accountingExportRows: 2,
    securityEvents: 7,
  };
}

function harness() {
  const state = initialState();
  const owners = [{ ...ownerRecord }];
  const createdServiceCodes: string[] = [];
  let ownerSessions = 2;

  const count = (key: keyof ResetState) => jest.fn(async () => state[key]);
  const remove = (key: keyof ResetState) =>
    jest.fn(async () => {
      const deleted = state[key];
      state[key] = 0;
      return { count: deleted };
    });

  const tx = {
    user: {
      count: jest.fn(
        async (args?: { where?: { role?: UserRole | { not: UserRole } } }) => {
          const role = args?.where?.role;
          if (role === UserRole.OWNER) return owners.length;
          if (typeof role === 'object' && role.not === UserRole.OWNER) {
            return state.nonOwnerUsers;
          }
          return owners.length + state.nonOwnerUsers;
        },
      ),
      findMany: jest.fn(async () => owners.map((owner) => ({ ...owner }))),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: remove('nonOwnerUsers'),
    },
    userAccessScope: {
      count: count('userAccessScopes'),
      deleteMany: remove('userAccessScopes'),
    },
    userSession: {
      count: jest.fn(
        async (args?: {
          where?: { user?: { role?: UserRole | { not: UserRole } } };
        }) => {
          const role = args?.where?.user?.role;
          return role === UserRole.OWNER
            ? ownerSessions
            : state.nonOwnerSessions;
        },
      ),
      deleteMany: remove('nonOwnerSessions'),
    },
    responsiblePerson: {
      count: count('responsiblePersons'),
      deleteMany: remove('responsiblePersons'),
    },
    management: {
      count: count('managements'),
      deleteMany: remove('managements'),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.managements += 1;
        return { id: 'new-management-id', ...data };
      }),
    },
    service: {
      count: count('services'),
      deleteMany: remove('services'),
      createMany: jest.fn(
        async ({ data }: { data: Array<{ code: string }> }) => {
          createdServiceCodes.push(...data.map((service) => service.code));
          state.services += data.length;
          return { count: data.length };
        },
      ),
    },
    unit: {
      count: count('units'),
      deleteMany: remove('units'),
    },
    inventoryItem: {
      count: count('inventoryItems'),
      deleteMany: remove('inventoryItems'),
    },
    stockBalance: {
      count: count('stockBalances'),
      deleteMany: remove('stockBalances'),
    },
    custodyBalance: {
      count: count('custodyBalances'),
      deleteMany: remove('custodyBalances'),
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
        const deleted = state.stockDocuments;
        state.stockDocuments = 0;
        state.mvoTransfers = 0;
        state.issues = 0;
        state.childIssues = 0;
        state.legacyIssues = 0;
        state.legacyDocuments = 0;
        return { count: deleted };
      }),
    },
    stockDocumentLine: {
      count: count('stockDocumentLines'),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: remove('stockDocumentLines'),
    },
    stockDocumentAttachment: {
      count: count('stockDocumentAttachments'),
      findMany: jest.fn(async () =>
        state.stockDocumentAttachments
          ? [
              { storagePath: 'document-a.pdf' },
              { storagePath: 'document-b.jpg' },
            ]
          : [],
      ),
      deleteMany: remove('stockDocumentAttachments'),
    },
    issueRealization: {
      count: count('issueRealizations'),
      deleteMany: remove('issueRealizations'),
    },
    issueRealizationLine: {
      count: count('issueRealizationLines'),
      deleteMany: remove('issueRealizationLines'),
    },
    issueRealizationAttachment: {
      count: count('issueRealizationAttachments'),
      findMany: jest.fn(async () =>
        state.issueRealizationAttachments
          ? [{ storagePath: 'realization-a.png' }]
          : [],
      ),
      deleteMany: remove('issueRealizationAttachments'),
    },
    stockTransaction: {
      count: count('stockTransactions'),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      deleteMany: remove('stockTransactions'),
    },
    importBatch: {
      count: count('importBatches'),
      deleteMany: remove('importBatches'),
    },
    importRow: {
      count: count('importRows'),
      deleteMany: remove('importRows'),
    },
    accountingTransferExportBatch: {
      count: count('accountingExportBatches'),
      deleteMany: remove('accountingExportBatches'),
    },
    accountingTransferExportBatchDocument: {
      count: count('accountingExportBatchDocuments'),
      deleteMany: remove('accountingExportBatchDocuments'),
    },
    accountingTransferExportRow: {
      count: count('accountingExportRows'),
      deleteMany: remove('accountingExportRows'),
    },
    securityEvent: {
      count: count('securityEvents'),
      deleteMany: remove('securityEvents'),
    },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };

  const prisma = {
    ...tx,
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => {
        const stateSnapshot = { ...state };
        const ownerSnapshot = owners.map((owner) => ({ ...owner }));
        const ownerSessionSnapshot = ownerSessions;
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(state, stateSnapshot);
          owners.splice(0, owners.length, ...ownerSnapshot);
          ownerSessions = ownerSessionSnapshot;
          throw error;
        }
      },
    ),
  };
  const storage = {
    listStoredFileNames: jest
      .fn()
      .mockResolvedValue([
        'document-a.pdf',
        'document-b.jpg',
        'realization-a.png',
        'unreferenced-orphan.pdf',
      ]),
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
    owners,
    createdServiceCodes,
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

  it('reports a dry run without deleting any record or file', async () => {
    const { service, prisma, tx, storage } = harness();

    const report = await service.run({ allowedFlag: 'YES', dryRun: true });

    expect(report.preserved).toEqual({ ownerUsers: 1, ownerSessions: 2 });
    expect(report.deleteCandidates).toMatchObject(initialState());
    expect(report.deleted).toBeNull();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.inventoryItem.deleteMany).not.toHaveBeenCalled();
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
    expect(formatBusinessDataResetReport(report)).toContain(
      '=== DRY RUN: NOTHING WILL BE DELETED ===',
    );
  });

  it('refuses a real reset when no OWNER account exists', async () => {
    const { service, owners, tx, storage } = harness();
    owners.splice(0, owners.length);

    await expect(service.run({ allowedFlag: 'YES' })).rejects.toThrow(
      'no OWNER user exists',
    );
    expect(tx.user.deleteMany).not.toHaveBeenCalled();
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
  });

  it('deletes all non-owner, organization and business records in FK-safe order', async () => {
    const { service, tx, storage, owners } = harness();
    const ownerBefore = { ...owners[0] };

    const report = await service.run({ allowedFlag: 'YES' });

    expect(report.preserved).toEqual({ ownerUsers: 1, ownerSessions: 2 });
    expect(report.currentBusinessState).toEqual(
      Object.fromEntries(
        Object.keys(report.deleteCandidates).map((key) => [key, 0]),
      ),
    );
    expect(owners[0]).toEqual(ownerBefore);
    expect(tx.userAccessScope.deleteMany).toHaveBeenCalledWith({});
    expect(tx.userSession.deleteMany).toHaveBeenCalledWith({
      where: { user: { role: { not: UserRole.OWNER } } },
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { role: { not: UserRole.OWNER } },
    });
    expect(tx.responsiblePerson.deleteMany).toHaveBeenCalledWith({});
    expect(tx.unit.deleteMany).toHaveBeenCalledWith({});
    expect(tx.service.deleteMany).toHaveBeenCalledWith({});
    expect(tx.management.deleteMany).toHaveBeenCalledWith({});
    expect(tx.inventoryItem.deleteMany).toHaveBeenCalledWith({});
    expect(tx.stockBalance.deleteMany).toHaveBeenCalledWith({});
    expect(tx.custodyBalance.deleteMany).toHaveBeenCalledWith({});
    expect(tx.stockTransaction.deleteMany).toHaveBeenCalledWith({});
    expect(tx.stockDocument.deleteMany).toHaveBeenCalledWith({});
    expect(tx.importRow.deleteMany).toHaveBeenCalledWith({});
    expect(tx.importBatch.deleteMany).toHaveBeenCalledWith({});
    expect(tx.securityEvent.deleteMany).toHaveBeenCalledWith({});
    expect(report.attachmentFilesDeleted).toBe(3);
    expect(report.orphanAttachmentFiles).toBe(1);
    expect(storage.stageForDeletion).toHaveBeenCalledTimes(3);
    expect(storage.finalizeDeletion).toHaveBeenCalledTimes(1);
    const sequenceStatements = tx.$executeRawUnsafe.mock.calls
      .map(([statement]) => statement)
      .filter((statement) => statement.startsWith('ALTER SEQUENCE'));
    expect(sequenceStatements).toEqual([
      'ALTER SEQUENCE "StockDocument_displayNumber_seq" RESTART WITH 1',
      'ALTER SEQUENCE "IssueRealization_displayNumber_seq" RESTART WITH 1',
    ]);

    expect(
      tx.stockDocumentAttachment.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.stockDocument.deleteMany.mock.invocationCallOrder[0]);
    expect(
      tx.userAccessScope.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.user.deleteMany.mock.invocationCallOrder[0]);
    expect(
      tx.userSession.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.user.deleteMany.mock.invocationCallOrder[0]);
    expect(tx.user.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.responsiblePerson.deleteMany.mock.invocationCallOrder[0],
    );
    expect(
      tx.responsiblePerson.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.unit.deleteMany.mock.invocationCallOrder[0]);
    expect(tx.unit.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.service.deleteMany.mock.invocationCallOrder[0],
    );
    expect(tx.service.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.management.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it('does not change OWNER id, login, password hash, role or active status', async () => {
    const { service, tx, owners } = harness();

    await service.run({ allowedFlag: 'YES' });

    expect(owners).toEqual([ownerRecord]);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.OWNER,
        responsiblePersonId: { not: null },
      },
      data: { responsiblePersonId: null },
    });
  });

  it('is idempotent when run repeatedly on an already clean database', async () => {
    const { service, storage } = harness();

    await service.run({ allowedFlag: 'YES' });
    const second = await service.run({ allowedFlag: 'YES' });

    expect(second.deleteCandidates).toEqual(
      Object.fromEntries(
        Object.keys(second.deleteCandidates).map((key) => [key, 0]),
      ),
    );
    expect(second.currentBusinessState).toEqual(second.deleteCandidates);
    expect(storage.stageForDeletion).toHaveBeenCalledTimes(3);
  });

  it('restores staged files when the database transaction fails', async () => {
    const { service, tx, storage, state } = harness();
    const before = { ...state };
    tx.stockDocument.deleteMany.mockRejectedValueOnce(new Error('FK failure'));

    await expect(service.run({ allowedFlag: 'YES' })).rejects.toThrow(
      'FK failure',
    );
    expect(storage.restoreStaged).toHaveBeenCalledWith([
      {
        storagePath: 'document-a.pdf',
        stagedStoragePath: '.deleting-document-a.pdf',
      },
      {
        storagePath: 'document-b.jpg',
        stagedStoragePath: '.deleting-document-b.jpg',
      },
      {
        storagePath: 'realization-a.png',
        stagedStoragePath: '.deleting-realization-a.png',
      },
    ]);
    expect(storage.finalizeDeletion).not.toHaveBeenCalled();
    expect(state).toEqual(before);
  });

  it('allows creating a new Management with exactly three base services after reset', async () => {
    const { service, prisma, state, createdServiceCodes } = harness();

    await service.run({ allowedFlag: 'YES' });
    const managements = new ManagementsService(prisma as never);
    await managements.create({
      name: 'Нове управління',
      code: 'NEW',
      isActive: true,
    });

    expect(state.managements).toBe(1);
    expect(state.services).toBe(3);
    expect(createdServiceCodes.sort()).toEqual(['IT', 'MTZ', 'UATZ']);
  });
});
