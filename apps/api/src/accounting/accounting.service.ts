import { Injectable, NotFoundException } from '@nestjs/common';
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
import { accountingTransfersCsv } from './accounting-transfer.csv';
import {
  AccountingTransferFiltersDto,
  ListAccountingExportBatchesQueryDto,
  ListAccountingTransfersQueryDto,
} from './dto/accounting-transfer-query.dto';

type RequestContext = { requestId?: string; ipAddress?: string; userAgent?: string };

const transferRowInclude = {
  inventoryItem: true,
  document: {
    include: {
      sourceResponsiblePerson: { include: { management: true } },
      destinationResponsiblePerson: { include: { management: true } },
    },
  },
} satisfies Prisma.StockDocumentLineInclude;

type TransferRow = Prisma.StockDocumentLineGetPayload<{ include: typeof transferRowInclude }>;

@Injectable()
export class AccountingService {
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
    const rows = await this.prisma.stockDocumentLine.findMany({
      where: this.transferWhere(filters),
      include: transferRowInclude,
      orderBy: [
        { document: { documentDate: 'asc' } },
        { document: { displayNumber: 'asc' } },
        { createdAt: 'asc' },
      ],
    });
    const snapshots = rows.map((row, index) => this.snapshot(row, index));
    const csv = accountingTransfersCsv(snapshots);
    const sha256 = createHash('sha256').update(csv, 'utf8').digest('hex');
    const filename = `mvo-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    const documentIds = [...new Set(rows.map((row) => row.documentId))];

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.accountingTransferExportBatch.create({
        data: {
          createdByUserId: actor.id,
          filters: this.filterSnapshot(filters),
          filename,
          sha256,
          documentCount: documentIds.length,
          rowCount: snapshots.length,
          documents: {
            create: documentIds.map((documentId) => ({ documentId })),
          },
          rows: { create: snapshots },
        },
      });
      if (documentIds.length) {
        await tx.stockDocument.updateMany({
          where: {
            id: { in: documentIds },
            type: StockDocumentType.MVO_TRANSFER,
            status: StockDocumentStatus.POSTED,
          },
          data: { accountingExportState: AccountingExportState.EXPORTED },
        });
      }
      await tx.securityEvent.create({
        data: {
          type: SecurityEventType.STOCK_DOCUMENT_ACTION,
          actorUserId: actor.id,
          targetUserId: actor.id,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
          metadata: {
            action: 'ACCOUNTING_MVO_TRANSFER_EXPORT',
            batchId: created.id,
            documentCount: documentIds.length,
            rowCount: snapshots.length,
          },
          success: true,
        },
      });
      return created;
    });

    return { batchId: batch.id, filename, csv };
  }

  async listExportBatches(query: ListAccountingExportBatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.accountingTransferExportBatch.findMany({
        include: { createdByUser: { select: { id: true, username: true, role: true } } },
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

  async downloadExportBatch(id: string) {
    const batch = await this.prisma.accountingTransferExportBatch.findUnique({
      where: { id },
      include: { rows: { orderBy: { rowOrder: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Пакет експорту не знайдено');
    const csv = accountingTransfersCsv(batch.rows);
    return { batchId: batch.id, filename: batch.filename, csv };
  }

  private transferWhere(filters: AccountingTransferFiltersDto): Prisma.StockDocumentLineWhereInput {
    return {
      inventoryItemId: filters.inventoryItemId,
      document: {
        type: StockDocumentType.MVO_TRANSFER,
        status: filters.status,
        accountingExportState: filters.exportState,
        sourceResponsiblePersonId: filters.sourceResponsiblePersonId,
        destinationResponsiblePersonId: filters.destinationResponsiblePersonId,
        documentNumber: filters.documentNumber?.trim()
          ? { contains: filters.documentNumber.trim(), mode: 'insensitive' }
          : undefined,
        documentDate: {
          gte: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : undefined,
          lte: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : undefined,
        },
      },
    };
  }

  private serializeTransferRow(row: TransferRow) {
    const destination = row.document.destinationResponsiblePerson;
    return {
      documentId: row.documentId,
      displayNumber: row.document.displayNumber,
      documentNumber: row.document.documentNumber,
      documentDate: row.document.documentDate.toISOString(),
      status: row.document.status,
      exportState: row.document.accountingExportState,
      postedAt: row.document.postedAt?.toISOString() ?? null,
      sourceResponsiblePerson: this.person(row.document.sourceResponsiblePerson),
      destinationResponsiblePerson: destination ? this.person(destination) : null,
      inventoryItem: row.inventoryItem,
      quantity: row.quantity.toString(),
    };
  }

  private snapshot(row: TransferRow, rowOrder: number) {
    const source = row.document.sourceResponsiblePerson;
    const destination = row.document.destinationResponsiblePerson;
    return {
      documentId: row.documentId,
      documentLineId: row.id,
      documentNumber: row.document.documentNumber,
      documentDate: row.document.documentDate,
      sourcePersonnelNumber: source.personnelNumber,
      sourceFullName: this.fullName(source),
      sourceManagementName: source.management.name,
      destinationPersonnelNumber: destination?.personnelNumber ?? '',
      destinationFullName: destination ? this.fullName(destination) : '',
      destinationManagementName: destination?.management.name ?? '',
      inventoryCode: row.inventoryItem.externalCode,
      inventoryName: row.inventoryItem.name,
      unitOfMeasure: row.inventoryItem.unitOfMeasure,
      quantity: row.quantity,
      documentStatus: row.document.status,
      postedAt: row.document.postedAt,
      rowOrder,
    };
  }

  private person(person: TransferRow['document']['sourceResponsiblePerson']) {
    return {
      id: person.id,
      personnelNumber: person.personnelNumber,
      fullName: this.fullName(person),
      management: { id: person.management.id, name: person.management.name },
    };
  }

  private fullName(person: { lastName: string; firstName: string; middleName: string | null }) {
    return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' ');
  }

  private filterSnapshot(filters: AccountingTransferFiltersDto): Prisma.InputJsonValue {
    return {
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      sourceResponsiblePersonId: filters.sourceResponsiblePersonId ?? null,
      destinationResponsiblePersonId: filters.destinationResponsiblePersonId ?? null,
      inventoryItemId: filters.inventoryItemId ?? null,
      status: filters.status ?? null,
      exportState: filters.exportState ?? null,
      documentNumber: filters.documentNumber?.trim() || null,
    };
  }
}
