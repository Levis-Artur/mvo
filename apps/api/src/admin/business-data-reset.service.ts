import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  StockDocumentAttachmentStorageService,
  type StagedAttachmentFile,
} from '../stock-documents/stock-document-attachment-storage.service';

export const BUSINESS_DATA_RESET_FLAG = 'ALLOW_BUSINESS_DATA_RESET';
export const BUSINESS_DATA_RESET_FLAG_VALUE = 'YES';
export const BUSINESS_DATA_RESET_REFUSAL =
  'REFUSED: set ALLOW_BUSINESS_DATA_RESET=YES';

const LOCK_BUSINESS_TABLES_SQL = `
LOCK TABLE
  "AccountingTransferExportRow",
  "AccountingTransferExportBatchDocument",
  "AccountingTransferExportBatch",
  "StockDocumentAttachment",
  "IssueRealizationAttachment",
  "IssueRealizationLine",
  "IssueRealization",
  "StockTransaction",
  "StockDocumentLine",
  "StockDocument",
  "StockBalance",
  "CustodyBalance",
  "ImportRow",
  "ImportBatch",
  "InventoryItem",
  "UserAccessScope",
  "UserSession",
  "SecurityEvent",
  "User",
  "ResponsiblePerson",
  "Unit",
  "Service",
  "Management"
IN ACCESS EXCLUSIVE MODE
`;

const RESET_DISPLAY_NUMBER_SEQUENCE_SQL = [
  'ALTER SEQUENCE "StockDocument_displayNumber_seq" RESTART WITH 1',
  'ALTER SEQUENCE "IssueRealization_displayNumber_seq" RESTART WITH 1',
] as const;

type ResetClient = PrismaService | Prisma.TransactionClient;

export type PreservedBusinessDataCounts = {
  ownerUsers: number;
  ownerSessions: number;
};

export type BusinessDataCounts = {
  nonOwnerUsers: number;
  userAccessScopes: number;
  nonOwnerSessions: number;
  responsiblePersons: number;
  managements: number;
  services: number;
  units: number;
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
  stockDocumentAttachments: number;
  issueRealizations: number;
  issueRealizationLines: number;
  issueRealizationAttachments: number;
  stockTransactions: number;
  importBatches: number;
  importRows: number;
  accountingExportBatches: number;
  accountingExportBatchDocuments: number;
  accountingExportRows: number;
  securityEvents: number;
};

export type BusinessDataResetReport = {
  dryRun: boolean;
  preserved: PreservedBusinessDataCounts;
  deleteCandidates: BusinessDataCounts;
  deleted: BusinessDataCounts | null;
  currentBusinessState: BusinessDataCounts | null;
  attachmentFilesDeleted: number;
  orphanAttachmentFiles: number;
  documentDisplayNumberReset: boolean;
};

type PreservedOwner = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
};

export type BusinessDataResetOptions = {
  dryRun?: boolean;
  allowedFlag?: string;
  onBeforeCommit?: (tx: Prisma.TransactionClient) => Promise<void>;
};

export class BusinessDataResetRefusedError extends Error {
  constructor() {
    super(BUSINESS_DATA_RESET_REFUSAL);
    this.name = 'BusinessDataResetRefusedError';
  }
}

export function isBusinessDataResetAllowed(value: string | undefined) {
  return value === BUSINESS_DATA_RESET_FLAG_VALUE;
}

export function assertBusinessDataResetAllowed(value: string | undefined) {
  if (!isBusinessDataResetAllowed(value)) {
    throw new BusinessDataResetRefusedError();
  }
}

@Injectable()
export class BusinessDataResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachmentStorage: StockDocumentAttachmentStorageService,
  ) {}

  async run(
    options: BusinessDataResetOptions = {},
  ): Promise<BusinessDataResetReport> {
    assertBusinessDataResetAllowed(
      options.allowedFlag ?? process.env[BUSINESS_DATA_RESET_FLAG],
    );

    if (options.dryRun) {
      const [preserved, deleteCandidates] = await Promise.all([
        this.preservedCounts(this.prisma),
        this.businessCounts(this.prisma),
      ]);
      return {
        dryRun: true,
        preserved,
        deleteCandidates,
        deleted: null,
        currentBusinessState: null,
        attachmentFilesDeleted: 0,
        orphanAttachmentFiles: 0,
        documentDisplayNumberReset: false,
      };
    }

    const stagedFiles: StagedAttachmentFile[] = [];
    let report: BusinessDataResetReport;
    try {
      report = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(LOCK_BUSINESS_TABLES_SQL);
          const [
            preservedBefore,
            ownersBefore,
            deleteCandidates,
            documentAttachments,
            realizationAttachments,
          ] = await Promise.all([
              this.preservedCounts(tx),
              this.preservedOwners(tx),
              this.businessCounts(tx),
              tx.stockDocumentAttachment.findMany({
                select: { storagePath: true },
                orderBy: { id: 'asc' },
              }),
              tx.issueRealizationAttachment.findMany({
                select: { storagePath: true },
                orderBy: { id: 'asc' },
              }),
            ]);
          if (preservedBefore.ownerUsers === 0) {
            throw new Error('Test data reset refused: no OWNER user exists');
          }

          const storagePaths = [
            ...new Set(
              [...documentAttachments, ...realizationAttachments].map(
                (item) => item.storagePath,
              ),
            ),
          ];
          const storedFileNames =
            await this.attachmentStorage.listStoredFileNames();
          const referencedStoragePaths = new Set(storagePaths);
          const orphanAttachmentFiles = storedFileNames.filter(
            (fileName) =>
              !fileName.startsWith('.deleting-') &&
              !referencedStoragePaths.has(fileName),
          ).length;
          for (const storagePath of storagePaths) {
            stagedFiles.push(
              await this.attachmentStorage.stageForDeletion(storagePath),
            );
          }

          await this.deleteBusinessData(tx);

          const [preservedAfter, ownersAfter, currentBusinessState] =
            await Promise.all([
              this.preservedCounts(tx),
              this.preservedOwners(tx),
              this.businessCounts(tx),
            ]);
          this.assertPreserved(
            preservedBefore,
            preservedAfter,
            ownersBefore,
            ownersAfter,
          );
          this.assertBusinessStateEmpty(currentBusinessState);
          if (options.onBeforeCommit) await options.onBeforeCommit(tx);
          for (const statement of RESET_DISPLAY_NUMBER_SEQUENCE_SQL) {
            await tx.$executeRawUnsafe(statement);
          }

          return {
            dryRun: false,
            preserved: preservedAfter,
            deleteCandidates,
            deleted: deleteCandidates,
            currentBusinessState,
            attachmentFilesDeleted: stagedFiles.length,
            orphanAttachmentFiles,
            documentDisplayNumberReset: true,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 120_000,
        },
      );
    } catch (error) {
      try {
        await this.attachmentStorage.restoreStaged(stagedFiles);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'Business data reset failed and staged attachment restoration also failed',
        );
      }
      throw error;
    }

    await this.attachmentStorage.finalizeDeletion(stagedFiles);
    return report;
  }

  private async deleteBusinessData(tx: Prisma.TransactionClient) {
    await tx.accountingTransferExportRow.deleteMany({});
    await tx.accountingTransferExportBatchDocument.deleteMany({});
    await tx.accountingTransferExportBatch.deleteMany({});
    await tx.stockDocumentAttachment.deleteMany({});
    await tx.issueRealizationAttachment.deleteMany({});
    await tx.issueRealizationLine.deleteMany({});
    await tx.issueRealization.deleteMany({});

    await tx.stockTransaction.updateMany({
      where: { reversalOfTransactionId: { not: null } },
      data: { reversalOfTransactionId: null },
    });
    await tx.stockTransaction.deleteMany({});

    await tx.stockDocumentLine.updateMany({
      where: { sourceTransferLineId: { not: null } },
      data: { sourceTransferLineId: null },
    });
    await tx.stockDocumentLine.deleteMany({});

    await tx.stockDocument.updateMany({
      where: { sourceTransferId: { not: null } },
      data: { sourceTransferId: null },
    });
    await tx.stockDocument.deleteMany({});

    await tx.stockBalance.deleteMany({});
    await tx.custodyBalance.deleteMany({});
    await tx.importRow.deleteMany({});
    await tx.importBatch.deleteMany({});
    await tx.inventoryItem.deleteMany({});
    await tx.userAccessScope.deleteMany({});
    await tx.userSession.deleteMany({
      where: { user: { role: { not: UserRole.OWNER } } },
    });
    await tx.user.updateMany({
      where: {
        role: UserRole.OWNER,
        responsiblePersonId: { not: null },
      },
      data: { responsiblePersonId: null },
    });
    await tx.user.deleteMany({ where: { role: { not: UserRole.OWNER } } });
    await tx.responsiblePerson.deleteMany({});
    await tx.unit.deleteMany({});
    await tx.service.deleteMany({});
    await tx.management.deleteMany({});
    await tx.securityEvent.deleteMany({});
  }

  private async preservedCounts(
    client: ResetClient,
  ): Promise<PreservedBusinessDataCounts> {
    const [ownerUsers, ownerSessions] = await Promise.all([
      client.user.count({ where: { role: UserRole.OWNER } }),
      client.userSession.count({
        where: { user: { role: UserRole.OWNER } },
      }),
    ]);
    return { ownerUsers, ownerSessions };
  }

  private preservedOwners(client: ResetClient): Promise<PreservedOwner[]> {
    return client.user.findMany({
      where: { role: UserRole.OWNER },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });
  }

  private async businessCounts(
    client: ResetClient,
  ): Promise<BusinessDataCounts> {
    const [
      nonOwnerUsers,
      userAccessScopes,
      nonOwnerSessions,
      responsiblePersons,
      managements,
      services,
      units,
      inventoryItems,
      stockBalances,
      custodyBalances,
      stockDocuments,
      mvoTransfers,
      issues,
      childIssues,
      legacyIssues,
      legacyDocuments,
      stockDocumentLines,
      stockDocumentAttachments,
      issueRealizations,
      issueRealizationLines,
      issueRealizationAttachments,
      stockTransactions,
      importBatches,
      importRows,
      accountingExportBatches,
      accountingExportBatchDocuments,
      accountingExportRows,
      securityEvents,
    ] = await Promise.all([
      client.user.count({ where: { role: { not: UserRole.OWNER } } }),
      client.userAccessScope.count(),
      client.userSession.count({
        where: { user: { role: { not: UserRole.OWNER } } },
      }),
      client.responsiblePerson.count(),
      client.management.count(),
      client.service.count(),
      client.unit.count(),
      client.inventoryItem.count(),
      client.stockBalance.count(),
      client.custodyBalance.count(),
      client.stockDocument.count(),
      client.stockDocument.count({
        where: { type: StockDocumentType.MVO_TRANSFER },
      }),
      client.stockDocument.count({ where: { type: StockDocumentType.ISSUE } }),
      client.stockDocument.count({
        where: {
          type: StockDocumentType.ISSUE,
          sourceTransferId: { not: null },
        },
      }),
      client.stockDocument.count({
        where: {
          type: StockDocumentType.ISSUE,
          sourceTransferId: null,
        },
      }),
      client.stockDocument.count({
        where: {
          type: {
            in: [StockDocumentType.TRANSFER, StockDocumentType.ASSIGNMENT],
          },
        },
      }),
      client.stockDocumentLine.count(),
      client.stockDocumentAttachment.count(),
      client.issueRealization.count(),
      client.issueRealizationLine.count(),
      client.issueRealizationAttachment.count(),
      client.stockTransaction.count(),
      client.importBatch.count(),
      client.importRow.count(),
      client.accountingTransferExportBatch.count(),
      client.accountingTransferExportBatchDocument.count(),
      client.accountingTransferExportRow.count(),
      client.securityEvent.count(),
    ]);
    return {
      nonOwnerUsers,
      userAccessScopes,
      nonOwnerSessions,
      responsiblePersons,
      managements,
      services,
      units,
      inventoryItems,
      stockBalances,
      custodyBalances,
      stockDocuments,
      mvoTransfers,
      issues,
      childIssues,
      legacyIssues,
      legacyDocuments,
      stockDocumentLines,
      stockDocumentAttachments,
      issueRealizations,
      issueRealizationLines,
      issueRealizationAttachments,
      stockTransactions,
      importBatches,
      importRows,
      accountingExportBatches,
      accountingExportBatchDocuments,
      accountingExportRows,
      securityEvents,
    };
  }

  private assertPreserved(
    before: PreservedBusinessDataCounts,
    after: PreservedBusinessDataCounts,
    ownersBefore: PreservedOwner[],
    ownersAfter: PreservedOwner[],
  ) {
    const stableKeys: (keyof PreservedBusinessDataCounts)[] = [
      'ownerUsers',
      'ownerSessions',
    ];
    for (const key of stableKeys) {
      if (before[key] !== after[key]) {
        throw new Error(`Preserved model count changed during reset: ${key}`);
      }
    }
    if (JSON.stringify(ownersBefore) !== JSON.stringify(ownersAfter)) {
      throw new Error('OWNER identity or credentials changed during reset');
    }
  }

  private assertBusinessStateEmpty(state: BusinessDataCounts) {
    const nonEmpty = Object.entries(state).filter(([, count]) => count !== 0);
    if (nonEmpty.length) {
      throw new Error(
        `Business data reset verification failed: ${nonEmpty
          .map(([name, count]) => `${name}=${count}`)
          .join(', ')}`,
      );
    }
  }
}

export function formatBusinessDataResetReport(report: BusinessDataResetReport) {
  const preserved = [
    `OWNER users: ${report.preserved.ownerUsers}`,
    `OWNER sessions: ${report.preserved.ownerSessions}`,
  ];
  const candidates = businessCountLines(report.deleteCandidates);
  if (report.dryRun) {
    return [
      '=== DRY RUN: NOTHING WILL BE DELETED ===',
      '',
      '=== PRESERVED ===',
      ...preserved.map((line) => `${line} -> preserve`),
      '',
      '=== WOULD DELETE ===',
      ...candidates.map((line) => `${line} -> delete`),
    ].join('\n');
  }

  return [
    '=== PRESERVED ===',
    ...preserved,
    '',
    '=== DELETED ===',
    ...businessCountLines(report.deleted ?? report.deleteCandidates),
    `Physical attachment files: ${report.attachmentFilesDeleted}`,
    `Orphan attachment files retained: ${report.orphanAttachmentFiles}`,
    `StockDocument displayNumber reset to №1: ${report.documentDisplayNumberReset ? 'yes' : 'no'}`,
    '',
    '=== CURRENT BUSINESS STATE ===',
    ...businessCountLines(report.currentBusinessState ?? report.deleteCandidates),
  ].join('\n');
}

function businessCountLines(counts: BusinessDataCounts) {
  return [
    `Non-OWNER users: ${counts.nonOwnerUsers}`,
    `UserAccessScopes: ${counts.userAccessScopes}`,
    `Non-OWNER sessions: ${counts.nonOwnerSessions}`,
    `ResponsiblePersons: ${counts.responsiblePersons}`,
    `Managements: ${counts.managements}`,
    `Services: ${counts.services}`,
    `Units: ${counts.units}`,
    `InventoryItems: ${counts.inventoryItems}`,
    `StockBalances: ${counts.stockBalances}`,
    `CustodyBalances: ${counts.custodyBalances}`,
    `StockDocuments: ${counts.stockDocuments}`,
    `MVO_TRANSFER documents: ${counts.mvoTransfers}`,
    `ISSUE documents: ${counts.issues}`,
    `Child ISSUE documents: ${counts.childIssues}`,
    `Legacy/standalone ISSUE documents: ${counts.legacyIssues}`,
    `Legacy TRANSFER/ASSIGNMENT documents: ${counts.legacyDocuments}`,
    `StockDocumentLines: ${counts.stockDocumentLines}`,
    `StockDocumentAttachments: ${counts.stockDocumentAttachments}`,
    `IssueRealizations: ${counts.issueRealizations}`,
    `IssueRealizationLines: ${counts.issueRealizationLines}`,
    `IssueRealizationAttachments: ${counts.issueRealizationAttachments}`,
    `StockTransactions: ${counts.stockTransactions}`,
    `ImportBatches: ${counts.importBatches}`,
    `ImportRows: ${counts.importRows}`,
    `AccountingTransferExportBatches: ${counts.accountingExportBatches}`,
    `AccountingTransferExportBatchDocuments: ${counts.accountingExportBatchDocuments}`,
    `AccountingTransferExportRows: ${counts.accountingExportRows}`,
    `SecurityEvents: ${counts.securityEvents}`,
  ];
}
