import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingExportState,
  Prisma,
  SecurityEventType,
  StockDocumentStatus,
  StockDocumentType,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1,
  ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2,
  buildAccountingTransferCsvV1,
  buildAccountingTransferCsvV2,
} from './accounting-transfer.csv';
import {
  AccountingTransferFiltersDto,
  ListAccountingExportBatchesQueryDto,
  ListAccountingTransfersQueryDto,
} from './dto/accounting-transfer-query.dto';

type RequestContext = {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
};

const transferRowInclude = {
  inventoryItem: true,
  document: {
    include: {
      sourceResponsiblePerson: { include: { management: true } },
      destinationResponsiblePerson: { include: { management: true } },
    },
  },
} satisfies Prisma.StockDocumentLineInclude;

const exportDocumentInclude = {
  sourceResponsiblePerson: { include: { management: true } },
  destinationResponsiblePerson: { include: { management: true } },
  lines: {
    include: { inventoryItem: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.StockDocumentInclude;

type TransferRow = Prisma.StockDocumentLineGetPayload<{
  include: typeof transferRowInclude;
}>;
type ExportDocument = Prisma.StockDocumentGetPayload<{
  include: typeof exportDocumentInclude;
}>;

const EXPORT_RETRY_LIMIT = 3;

class ExportSetChangedError extends Error {
  constructor() {
    super('Eligible MVO transfer set changed during export');
    this.name = 'ExportSetChangedError';
  }
}

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listTransfers(query: ListAccountingTransfersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = this.transferWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.stockDocumentLine.findMany({
        where,
        include: transferRowInclude,
        orderBy: [
          { document: { documentDate: 'desc' } },
          { document: { displayNumber: 'desc' } },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockDocumentLine.count({ where }),
    ]);
    return {
      items: items.map((row) => this.serializeTransferRow(row)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async exportTransfers(
    filters: AccountingTransferFiltersDto,
    actor: CurrentUser,
    context: RequestContext,
  ) {
    try {
      for (let attempt = 1; attempt <= EXPORT_RETRY_LIMIT; attempt += 1) {
        try {
          const batchId = await this.prisma.$transaction(
            (tx) => this.createExportBatchInTx(tx, filters, actor, context),
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              maxWait: 5_000,
              timeout: 30_000,
            },
          );
          return this.renderPersistedBatch(batchId);
        } catch (error) {
          if (!this.isRetryableExportConflict(error)) throw error;
          if (attempt === EXPORT_RETRY_LIMIT) {
            throw new ConflictException(
              'Склад передач для експорту змінився. Оновіть реєстр і повторіть спробу.',
            );
          }
        }
      }
      throw new ConflictException(
        'Склад передач для експорту змінився. Оновіть реєстр і повторіть спробу.',
      );
    } catch (error) {
      await this.auditExportFailure(actor, context, error);
      throw error;
    }
  }

  async listExportBatches(query: ListAccountingExportBatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.accountingTransferExportBatch.findMany({
        include: {
          createdByUser: { select: { id: true, username: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingTransferExportBatch.count(),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async downloadExportBatch(
    id: string,
    actor: CurrentUser,
    context: RequestContext,
  ) {
    try {
      const exported = await this.renderPersistedBatch(id);
      await this.prisma.securityEvent.create({
        data: {
          type: SecurityEventType.STOCK_DOCUMENT_ACTION,
          actorUserId: actor.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            action: 'ACCOUNTING_MVO_TRANSFER_EXPORT_DOWNLOAD',
            batchId: id,
            documentCount: exported.documentCount,
            rowCount: exported.rowCount,
          },
          success: true,
        },
      });
      return exported;
    } catch (error) {
      await this.prisma.securityEvent.create({
        data: {
          type: SecurityEventType.STOCK_DOCUMENT_ACTION,
          actorUserId: actor.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            action: 'ACCOUNTING_MVO_TRANSFER_EXPORT_DOWNLOAD',
            batchId: id,
            reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
          },
          success: false,
        },
      });
      throw error;
    }
  }

  private async createExportBatchInTx(
    tx: Prisma.TransactionClient,
    filters: AccountingTransferFiltersDto,
    actor: CurrentUser,
    context: RequestContext,
  ) {
    const documents = await tx.stockDocument.findMany({
      where: this.exportDocumentWhere(filters),
      include: exportDocumentInclude,
      orderBy: [{ documentDate: 'asc' }, { displayNumber: 'asc' }],
    });
    if (!documents.length) {
      throw new ConflictException(
        'Немає нових проведених передач, які ще не передано бухгалтерії.',
      );
    }

    documents.forEach((document) => this.assertDisplayNumber(document));
    const snapshots = documents.flatMap((document) =>
      document.lines.map((line) => ({ document, line })),
    ).map(({ document, line }, rowOrder) =>
      this.snapshot(document, line, rowOrder),
    );
    const csv = buildAccountingTransferCsvV2(snapshots);
    const sha256 = this.csvSha256(csv);
    const exportedAt = new Date();
    const filename = `mvo-transfers-${exportedAt.toISOString().slice(0, 10)}.csv`;
    const documentIds = documents.map((document) => document.id);

    const batch = await tx.accountingTransferExportBatch.create({
      data: {
        createdByUserId: actor.id,
        filters: this.filterSnapshot(filters),
        filename,
        sha256,
        formatVersion: ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2,
        documentCount: documentIds.length,
        rowCount: snapshots.length,
        documents: {
          create: documentIds.map((documentId) => ({ documentId })),
        },
        rows: { create: snapshots },
      },
    });

    const claimed = await tx.stockDocument.updateMany({
      where: {
        id: { in: documentIds },
        type: StockDocumentType.MVO_TRANSFER,
        status: StockDocumentStatus.POSTED,
        accountingExportState: AccountingExportState.NOT_EXPORTED,
      },
      data: {
        accountingExportState: AccountingExportState.EXPORTED,
        exportedAt,
        exportedByUserId: actor.id,
      },
    });
    if (claimed.count !== documentIds.length) {
      throw new ExportSetChangedError();
    }

    await tx.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          action: 'ACCOUNTING_MVO_TRANSFER_EXPORT',
          batchId: batch.id,
          documentCount: documentIds.length,
          rowCount: snapshots.length,
        },
        success: true,
      },
    });
    return batch.id;
  }

  private async renderPersistedBatch(id: string) {
    const batch = await this.prisma.accountingTransferExportBatch.findUnique({
      where: { id },
      include: { rows: { orderBy: { rowOrder: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Пакет експорту не знайдено');
    const csv = this.renderBatchCsv(batch);
    const generatedSha256 = this.csvSha256(csv);
    if (generatedSha256.toLowerCase() !== batch.sha256.toLowerCase()) {
      this.logger.error(
        `Accounting export integrity error batchId=${batch.id}: sha256 mismatch`,
      );
      throw new InternalServerErrorException(
        'Цілісність пакета експорту порушено. Завантаження неможливе.',
      );
    }
    return {
      batchId: batch.id,
      filename: batch.filename,
      csv,
      documentCount: batch.documentCount,
      rowCount: batch.rowCount,
    };
  }

  private renderBatchCsv(
    batch: Prisma.AccountingTransferExportBatchGetPayload<{
      include: { rows: true };
    }>,
  ) {
    if (batch.formatVersion === ACCOUNTING_TRANSFER_EXPORT_FORMAT_V1) {
      return buildAccountingTransferCsvV1(batch.rows);
    }
    if (batch.formatVersion === ACCOUNTING_TRANSFER_EXPORT_FORMAT_V2) {
      for (const row of batch.rows) {
        if (
          !Number.isSafeInteger(row.displayNumber) ||
          row.displayNumber! <= 0
        ) {
          this.logger.error(
            `Accounting export integrity error batchId=${batch.id} rowId=${row.id}: displayNumber is missing`,
          );
          throw new InternalServerErrorException(
            'Пакет експорту містить рядок без коректного номера документа.',
          );
        }
      }
      return buildAccountingTransferCsvV2(
        batch.rows.map((row) => ({
          ...row,
          displayNumber: row.displayNumber!,
        })),
      );
    }

    this.logger.error(
      `Accounting export integrity error batchId=${batch.id}: unsupported formatVersion=${batch.formatVersion}`,
    );
    throw new InternalServerErrorException(
      'Пакет експорту має непідтримувану версію формату.',
    );
  }

  private csvSha256(csv: string) {
    return createHash('sha256').update(csv, 'utf8').digest('hex');
  }

  private transferWhere(
    filters: ListAccountingTransfersQueryDto,
  ): Prisma.StockDocumentLineWhereInput {
    return {
      inventoryItemId: filters.inventoryItemId,
      document: {
        type: StockDocumentType.MVO_TRANSFER,
        status: filters.status,
        accountingExportState: filters.exportState,
        sourceResponsiblePersonId: filters.sourceResponsiblePersonId,
        destinationResponsiblePersonId: filters.destinationResponsiblePersonId,
        displayNumber: this.parseDisplayNumber(filters.documentNumber),
        documentDate: this.dateRange(filters),
      },
    };
  }

  private exportDocumentWhere(
    filters: AccountingTransferFiltersDto,
  ): Prisma.StockDocumentWhereInput {
    return {
      type: StockDocumentType.MVO_TRANSFER,
      status: StockDocumentStatus.POSTED,
      accountingExportState: AccountingExportState.NOT_EXPORTED,
      sourceResponsiblePersonId: filters.sourceResponsiblePersonId,
      destinationResponsiblePersonId: filters.destinationResponsiblePersonId,
      displayNumber: this.parseDisplayNumber(filters.documentNumber),
      documentDate: this.dateRange(filters),
      lines: filters.inventoryItemId
        ? { some: { inventoryItemId: filters.inventoryItemId } }
        : undefined,
    };
  }

  private dateRange(filters: { dateFrom?: string; dateTo?: string }) {
    return {
      gte: filters.dateFrom
        ? new Date(`${filters.dateFrom}T00:00:00.000Z`)
        : undefined,
      lte: filters.dateTo
        ? new Date(`${filters.dateTo}T23:59:59.999Z`)
        : undefined,
    };
  }

  private parseDisplayNumber(value?: string) {
    if (!value?.trim()) return undefined;
    const normalized = value.trim().replace(/^№\s*/, '');
    const displayNumber = Number(normalized);
    if (!Number.isSafeInteger(displayNumber) || displayNumber <= 0) {
      throw new BadRequestException(
        'Номер документа має бути додатним цілим числом.',
      );
    }
    return displayNumber;
  }

  private serializeTransferRow(row: TransferRow) {
    const destination = row.document.destinationResponsiblePerson;
    return {
      documentId: row.documentId,
      displayNumber: row.document.displayNumber,
      documentDate: row.document.documentDate.toISOString(),
      status: row.document.status,
      exportState: row.document.accountingExportState,
      exportedAt: row.document.exportedAt?.toISOString() ?? null,
      postedAt: row.document.postedAt?.toISOString() ?? null,
      sourceResponsiblePerson: this.person(row.document.sourceResponsiblePerson),
      destinationResponsiblePerson: destination ? this.person(destination) : null,
      inventoryItem: row.inventoryItem,
      quantity: row.quantity.toString(),
    };
  }

  private snapshot(
    document: ExportDocument,
    line: ExportDocument['lines'][number],
    rowOrder: number,
  ) {
    const source = document.sourceResponsiblePerson;
    const destination = document.destinationResponsiblePerson;
    return {
      documentId: document.id,
      documentLineId: line.id,
      documentNumber: document.documentNumber,
      displayNumber: document.displayNumber,
      documentDate: document.documentDate,
      sourcePersonnelNumber: source.personnelNumber,
      sourceFullName: this.fullName(source),
      sourceManagementName: source.management.name,
      destinationPersonnelNumber: destination?.personnelNumber ?? '',
      destinationFullName: destination ? this.fullName(destination) : '',
      destinationManagementName: destination?.management.name ?? '',
      inventoryCode: line.inventoryItem.externalCode,
      inventoryName: line.inventoryItem.name,
      unitOfMeasure: line.inventoryItem.unitOfMeasure,
      quantity: line.quantity,
      documentStatus: document.status,
      postedAt: document.postedAt,
      rowOrder,
    };
  }

  private assertDisplayNumber(document: Pick<ExportDocument, 'id' | 'displayNumber'>) {
    if (
      !Number.isSafeInteger(document.displayNumber) ||
      document.displayNumber <= 0
    ) {
      this.logger.error(
        `Accounting export integrity error documentId=${document.id}: displayNumber is missing`,
      );
      throw new ConflictException(
        'Передача не має коректного номера документа та не може бути експортована.',
      );
    }
  }

  private person(person: TransferRow['document']['sourceResponsiblePerson']) {
    return {
      id: person.id,
      personnelNumber: person.personnelNumber,
      fullName: this.fullName(person),
      management: { id: person.management.id, name: person.management.name },
    };
  }

  private fullName(person: {
    lastName: string;
    firstName: string;
    middleName: string | null;
  }) {
    return [person.lastName, person.firstName, person.middleName]
      .filter(Boolean)
      .join(' ');
  }

  private filterSnapshot(
    filters: AccountingTransferFiltersDto,
  ): Prisma.InputJsonValue {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      sourceResponsiblePersonId: filters.sourceResponsiblePersonId ?? null,
      destinationResponsiblePersonId:
        filters.destinationResponsiblePersonId ?? null,
      inventoryItemId: filters.inventoryItemId ?? null,
      displayNumber: this.parseDisplayNumber(filters.documentNumber) ?? null,
    };
  }

  private isRetryableExportConflict(error: unknown) {
    return (
      error instanceof ExportSetChangedError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034')
    );
  }

  private auditExportFailure(
    actor: CurrentUser,
    context: RequestContext,
    error: unknown,
  ) {
    return this.prisma.securityEvent.create({
      data: {
        type: SecurityEventType.STOCK_DOCUMENT_ACTION,
        actorUserId: actor.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          action: 'ACCOUNTING_MVO_TRANSFER_EXPORT',
          reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
        },
        success: false,
      },
    });
  }
}
