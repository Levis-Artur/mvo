import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SecurityEventType,
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

const BUSINESS_AUDIT_EVENT_TYPES = [
  SecurityEventType.STOCK_DOCUMENT_ACTION,
  SecurityEventType.IMPORT_ACTION,
] as const;

const LOCK_BUSINESS_TABLES_SQL = `
LOCK TABLE
  "AccountingTransferExportRow",
  "AccountingTransferExportBatchDocument",
  "AccountingTransferExportBatch",
  "StockDocumentAttachment",
  "StockTransaction",
  "StockDocumentLine",
  "StockDocument",
  "StockBalance",
  "CustodyBalance",
  "ImportRow",
  "ImportBatch",
  "InventoryItem",
  "SecurityEvent"
IN ACCESS EXCLUSIVE MODE
`;

const RESET_STOCK_DOCUMENT_SEQUENCE_SQL = `
ALTER SEQUENCE "StockDocument_displayNumber_seq" RESTART WITH 1
`;

type ResetClient = PrismaService | Prisma.TransactionClient;

export type PreservedBusinessDataCounts = {
  users: number;
  accountantUsers: number;
  ownerUsers: number;
  userSessions: number;
  responsiblePersons: number;
  responsiblePersonsWithAccountingCode: number;
  managements: number;
  services: number;
  units: number;
  retainedSecurityEvents: number;
};

export type BusinessDataCounts = {
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

export type BusinessDataResetReport = {
  dryRun: boolean;
  preserved: PreservedBusinessDataCounts;
  deleteCandidates: BusinessDataCounts;
  deleted: BusinessDataCounts | null;
  currentBusinessState: BusinessDataCounts | null;
  attachmentFilesDeleted: number;
  documentDisplayNumberReset: boolean;
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
        documentDisplayNumberReset: false,
      };
    }

    const stagedFiles: StagedAttachmentFile[] = [];
    let report: BusinessDataResetReport;
    try {
      report = await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(LOCK_BUSINESS_TABLES_SQL);
          const [preservedBefore, deleteCandidates, attachments] =
            await Promise.all([
              this.preservedCounts(tx),
              this.businessCounts(tx),
              tx.stockDocumentAttachment.findMany({
                select: { storagePath: true },
                orderBy: { id: 'asc' },
              }),
            ]);

          const storagePaths = [
            ...new Set(attachments.map((item) => item.storagePath)),
          ];
          for (const storagePath of storagePaths) {
            stagedFiles.push(
              await this.attachmentStorage.stageForDeletion(storagePath),
            );
          }

          await this.deleteBusinessData(tx);
          if (options.onBeforeCommit) await options.onBeforeCommit(tx);

          const [preservedAfter, currentBusinessState] = await Promise.all([
            this.preservedCounts(tx),
            this.businessCounts(tx),
          ]);
          this.assertPreserved(preservedBefore, preservedAfter);
          this.assertBusinessStateEmpty(currentBusinessState);
          await tx.$executeRawUnsafe(RESET_STOCK_DOCUMENT_SEQUENCE_SQL);

          return {
            dryRun: false,
            preserved: preservedAfter,
            deleteCandidates,
            deleted: deleteCandidates,
            currentBusinessState,
            attachmentFilesDeleted: stagedFiles.length,
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
    await tx.securityEvent.deleteMany({
      where: { type: { in: [...BUSINESS_AUDIT_EVENT_TYPES] } },
    });
  }

  private async preservedCounts(
    client: ResetClient,
  ): Promise<PreservedBusinessDataCounts> {
    const [
      users,
      accountantUsers,
      ownerUsers,
      userSessions,
      responsiblePersons,
      responsiblePersonsWithAccountingCode,
      managements,
      services,
      units,
      retainedSecurityEvents,
    ] = await Promise.all([
      client.user.count(),
      client.user.count({ where: { role: UserRole.ACCOUNTANT } }),
      client.user.count({ where: { role: UserRole.OWNER } }),
      client.userSession.count(),
      client.responsiblePerson.count(),
      client.responsiblePerson.count({
        where: { externalAccountingCode: { not: null } },
      }),
      client.management.count(),
      client.service.count(),
      client.unit.count(),
      client.securityEvent.count({
        where: { type: { notIn: [...BUSINESS_AUDIT_EVENT_TYPES] } },
      }),
    ]);
    return {
      users,
      accountantUsers,
      ownerUsers,
      userSessions,
      responsiblePersons,
      responsiblePersonsWithAccountingCode,
      managements,
      services,
      units,
      retainedSecurityEvents,
    };
  }

  private async businessCounts(
    client: ResetClient,
  ): Promise<BusinessDataCounts> {
    const [
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
      attachments,
      stockTransactions,
      importBatches,
      importRows,
      accountingExportBatches,
      accountingExportBatchDocuments,
      accountingExportRows,
      businessAuditEvents,
    ] = await Promise.all([
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
      client.stockTransaction.count(),
      client.importBatch.count(),
      client.importRow.count(),
      client.accountingTransferExportBatch.count(),
      client.accountingTransferExportBatchDocument.count(),
      client.accountingTransferExportRow.count(),
      client.securityEvent.count({
        where: { type: { in: [...BUSINESS_AUDIT_EVENT_TYPES] } },
      }),
    ]);
    return {
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
      attachments,
      stockTransactions,
      importBatches,
      importRows,
      accountingExportBatches,
      accountingExportBatchDocuments,
      accountingExportRows,
      businessAuditEvents,
    };
  }

  private assertPreserved(
    before: PreservedBusinessDataCounts,
    after: PreservedBusinessDataCounts,
  ) {
    const stableKeys: (keyof PreservedBusinessDataCounts)[] = [
      'users',
      'accountantUsers',
      'ownerUsers',
      'userSessions',
      'responsiblePersons',
      'responsiblePersonsWithAccountingCode',
      'managements',
      'services',
      'units',
    ];
    for (const key of stableKeys) {
      if (before[key] !== after[key]) {
        throw new Error(`Preserved model count changed during reset: ${key}`);
      }
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
    `Users: ${report.preserved.users}`,
    `ACCOUNTANT users: ${report.preserved.accountantUsers}`,
    `OWNER users: ${report.preserved.ownerUsers}`,
    `User sessions: ${report.preserved.userSessions}`,
    `ResponsiblePersons (MVO): ${report.preserved.responsiblePersons}`,
    `MVO with externalAccountingCode: ${report.preserved.responsiblePersonsWithAccountingCode}`,
    `Managements: ${report.preserved.managements}`,
    `Services: ${report.preserved.services}`,
    `Units: ${report.preserved.units}`,
    `Security events retained: ${report.preserved.retainedSecurityEvents}`,
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
    `StockDocument displayNumber reset to №1: ${report.documentDisplayNumberReset ? 'yes' : 'no'}`,
    '',
    '=== CURRENT BUSINESS STATE ===',
    ...businessCountLines(report.currentBusinessState ?? report.deleteCandidates),
  ].join('\n');
}

function businessCountLines(counts: BusinessDataCounts) {
  return [
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
    `StockDocumentAttachments: ${counts.attachments}`,
    `StockTransactions: ${counts.stockTransactions}`,
    `ImportBatches: ${counts.importBatches}`,
    `ImportRows: ${counts.importRows}`,
    `AccountingTransferExportBatches: ${counts.accountingExportBatches}`,
    `AccountingTransferExportBatchDocuments: ${counts.accountingExportBatchDocuments}`,
    `AccountingTransferExportRows: ${counts.accountingExportRows}`,
    `Business audit events: ${counts.businessAuditEvents}`,
  ];
}
