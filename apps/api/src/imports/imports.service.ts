import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ImportRowStatus,
  ImportStatus,
  ImportType,
  InventoryItemReviewStatus,
  Prisma,
  SecurityEventType,
  StockAccountingModel,
  StockSourceKind,
  StockTransactionType,
} from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { ImportParserService, ParsedImportRow } from './import-parser.service';
import { ListImportRowsQueryDto } from './dto/list-import-rows-query.dto';
import { ListImportsQueryDto } from './dto/list-imports-query.dto';
import { UpdateImportMappingsDto } from './dto/update-import-mappings.dto';
import { normalizeImportFilename } from './import-filename.util';

const importInclude = {
  rows: false,
} satisfies Prisma.ImportBatchInclude;

type ImportAudit = {
  actor: CurrentUser;
  context: {
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
  };
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportParserService,
    private readonly stockService: StockService,
  ) {}

  async upload(input: {
    file: Express.Multer.File;
    importType: ImportType;
    maxFileSizeBytes: number;
    audit?: ImportAudit;
  }) {
    if (!input.file) {
      throw new BadRequestException('Файл не передано');
    }

    const originalFilename = normalizeImportFilename(input.file.originalname);
    if (!/\.(csv|tsv)$/i.test(originalFilename)) {
      throw new BadRequestException('Підтримуються лише .csv або .tsv файли');
    }

    const parsed = this.parser.parse(
      input.file.buffer,
      input.importType,
      input.maxFileSizeBytes,
    );
    const duplicate = await this.prisma.importBatch.findUnique({
      where: { fileHash: parsed.fileHash },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Такий файл уже завантажувався раніше');
    }

    const enrichedRows = await this.enrichRows(parsed.rows, input.importType);
    const counters = this.countRows(enrichedRows);

    const batch = await this.prisma.importBatch.create({
      data: {
        type: input.importType,
        status:
          counters.errorRows > 0
            ? ImportStatus.UPLOADED
            : ImportStatus.VALIDATED,
        originalFilename,
        fileHash: parsed.fileHash,
        fileSize: input.file.size,
        encoding: parsed.encoding,
        delimiter: parsed.delimiter === '\t' ? 'tab' : parsed.delimiter,
        totalRows: parsed.totalRows,
        ...counters,
        validatedAt: new Date(),
        rows: {
          create: enrichedRows.map((row) => ({
            rowNumber: row.rowNumber,
            status: row.status,
            counterpartyRaw: row.counterpartyRaw,
            nomenclatureCodeRaw: row.nomenclatureCodeRaw,
            itemNameRaw: row.itemNameRaw,
            unitOfMeasureRaw: row.unitOfMeasureRaw,
            debitQuantityRaw: row.debitQuantityRaw,
            endingQuantityRaw: row.endingQuantityRaw,
            parsedQuantity: row.parsedQuantity,
            responsiblePersonId: row.responsiblePersonId,
            inventoryItemId: row.inventoryItemId,
            message: row.message,
            systemBalance: row.systemBalance,
            fileEndingBalance: row.fileEndingBalance,
            balanceDifference: row.balanceDifference,
          })),
        },
      },
    });
    await this.audit(this.prisma, batch.id, 'UPLOAD', true, input.audit);
    return batch;
  }

  async findAll(query: ListImportsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ImportBatchWhereInput = {
      type: query.type,
      status: query.status,
    };
    const [items, total] = await Promise.all([
      this.prisma.importBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.importBatch.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: importInclude,
    });

    if (!batch) {
      throw new NotFoundException('Імпорт не знайдено');
    }

    const counters = await this.previewCounters(id);
    return { ...batch, preview: counters };
  }

  async rows(id: string, query: ListImportRowsQueryDto) {
    await this.findOne(id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ImportRowWhereInput = {
      importBatchId: id,
      status: query.status,
      OR: search
        ? [
            { counterpartyRaw: { contains: search, mode: 'insensitive' } },
            { nomenclatureCodeRaw: { contains: search, mode: 'insensitive' } },
            { itemNameRaw: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.importRow.findMany({
        where,
        orderBy: { rowNumber: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          responsiblePerson: {
            select: {
              id: true,
              lastName: true,
              firstName: true,
              middleName: true,
              personnelNumber: true,
            },
          },
          inventoryItem: {
            select: {
              id: true,
              externalCode: true,
              name: true,
              unitOfMeasure: true,
            },
          },
        },
      }),
      this.prisma.importRow.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        parsedQuantity: row.parsedQuantity?.toString() ?? null,
        systemBalance: row.systemBalance?.toString() ?? null,
        fileEndingBalance: row.fileEndingBalance?.toString() ?? null,
        balanceDifference: row.balanceDifference?.toString() ?? null,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateMappings(
    id: string,
    dto: UpdateImportMappingsDto,
    audit?: ImportAudit,
  ) {
    const batch = await this.findOne(id);
    this.ensureMutable(batch.status);

    for (const mapping of dto.mappings) {
      const responsiblePerson = await this.prisma.responsiblePerson.findUnique({
        where: { id: mapping.responsiblePersonId },
        select: { id: true },
      });

      if (!responsiblePerson) {
        throw new BadRequestException('Обраного МВО не знайдено');
      }

      await this.prisma.importRow.updateMany({
        where: { importBatchId: id, counterpartyRaw: mapping.counterpartyRaw },
        data: { responsiblePersonId: mapping.responsiblePersonId },
      });

      if (mapping.saveExternalAccountingName) {
        await this.prisma.responsiblePerson.update({
          where: { id: mapping.responsiblePersonId },
          data: {
            externalAccountingName: mapping.counterpartyRaw,
            externalAccountingCode: this.extractExternalCode(
              mapping.counterpartyRaw,
            ),
          },
        });
      }
    }

    const result = await this.validate(id);
    await this.audit(this.prisma, id, 'UPDATE_MAPPINGS', true, audit);
    return result;
  }

  async validate(id: string, audit?: ImportAudit) {
    const batch = await this.findOne(id);
    this.ensureMutable(batch.status);
    const rows = await this.prisma.importRow.findMany({
      where: { importBatchId: id },
    });

    const updatedRows = await Promise.all(
      rows.map(async (row) => {
        if (row.status === ImportRowStatus.SKIPPED) return row;
        const messages = (
          row.message?.split('; ').filter(Boolean) ?? []
        ).filter(
          (message) =>
            message.startsWith('Нова номенклатура') ||
            message.startsWith('Конфлікт назви') ||
            message.startsWith('Розбіжність'),
        );
        const blocking: string[] = [];

        if (!row.responsiblePersonId) {
          blocking.push('Не зіставлено МВО');
        }

        const status =
          blocking.length > 0
            ? ImportRowStatus.ERROR
            : messages.length > blocking.length
              ? ImportRowStatus.WARNING
              : ImportRowStatus.VALID;

        return this.prisma.importRow.update({
          where: { id: row.id },
          data: {
            status,
            message: [
              ...blocking,
              ...messages.filter((m) => !blocking.includes(m)),
            ]
              .filter(Boolean)
              .join('; '),
          },
        });
      }),
    );
    const counters = this.countRows(updatedRows);

    const result = await this.prisma.importBatch.update({
      where: { id },
      data: {
        ...counters,
        status:
          counters.errorRows > 0
            ? ImportStatus.UPLOADED
            : ImportStatus.VALIDATED,
        validatedAt: new Date(),
      },
    });
    await this.audit(this.prisma, id, 'VALIDATE', true, audit);
    return result;
  }

  async cancel(id: string, audit?: ImportAudit) {
    const batch = await this.findOne(id);

    if (batch.status === ImportStatus.COMPLETED) {
      throw new BadRequestException('Проведений імпорт не можна скасувати');
    }

    const result = await this.prisma.importBatch.update({
      where: { id },
      data: { status: ImportStatus.CANCELLED },
    });
    await this.audit(this.prisma, id, 'CANCEL', true, audit);
    return result;
  }

  async commit(id: string, audit?: ImportAudit) {
    try {
      await this.runSerializable(async () => {
        let importedRows = 0;

        return this.prisma.$transaction(
          async (tx) => {
          const batch = await tx.importBatch.findUnique({
            where: { id },
          });

          if (!batch) {
            throw new NotFoundException('Імпорт не знайдено');
          }

          if (batch.status !== ImportStatus.VALIDATED) {
            throw new BadRequestException(
              'Проведення дозволене лише для перевіреного імпорту',
            );
          }

          if (batch.errorRows > 0) {
            throw new BadRequestException('Імпорт містить помилки');
          }

          const allRows = await tx.importRow.findMany({
            where: { importBatchId: id },
            orderBy: { rowNumber: 'asc' },
          });
          const allowedBeforeCommit: ImportRowStatus[] = [
            ImportRowStatus.VALID,
            ImportRowStatus.WARNING,
            ImportRowStatus.SKIPPED,
          ];
          const commitRowStatuses: ImportRowStatus[] = [
            ImportRowStatus.VALID,
            ImportRowStatus.WARNING,
          ];
          const blockingRows = allRows.filter(
            (row) =>
              row.status === ImportRowStatus.ERROR ||
              !allowedBeforeCommit.includes(row.status),
          );

          if (blockingRows.length > 0) {
            throw new BadRequestException('Імпорт містить блокуючі рядки');
          }

          const rows = allRows.filter((row) =>
            commitRowStatuses.includes(row.status),
          );

          if (rows.some((row) => !row.responsiblePersonId)) {
            throw new BadRequestException('Не всі МВО зіставлені');
          }

          if (
            rows.some(
              (row) =>
                !row.nomenclatureCodeRaw.trim() ||
                !row.itemNameRaw.trim() ||
                !row.parsedQuantity,
            )
          ) {
            throw new BadRequestException(
              'Не всі рядки мають код, назву та кількість',
            );
          }

          if (batch.type === ImportType.INITIAL_BALANCE) {
            const responsiblePersonIds = [
              ...new Set(rows.map((row) => row.responsiblePersonId!)),
            ];
            const existing = await tx.stockTransaction.findFirst({
              where: {
                type: StockTransactionType.INITIAL_BALANCE,
                responsiblePersonId: { in: responsiblePersonIds },
              },
            });

            if (existing) {
              throw new BadRequestException(
                'Для одного з МВО вже є початковий імпорт',
              );
            }
          }

          for (const row of rows) {
            let inventoryItemId = row.inventoryItemId;

            if (!inventoryItemId) {
              const item = await tx.inventoryItem.upsert({
                where: { externalCode: row.nomenclatureCodeRaw },
                update: {},
                create: {
                  externalCode: row.nomenclatureCodeRaw,
                  name: row.itemNameRaw,
                  unitOfMeasure: row.unitOfMeasureRaw,
                  reviewStatus: InventoryItemReviewStatus.NEEDS_REVIEW,
                  createdManually: false,
                },
              });
              inventoryItemId = item.id;
            }

            const transaction =
              await this.stockService.createIncreasingTransactionInTx(tx, {
                type:
                  batch.type === ImportType.INITIAL_BALANCE
                    ? StockTransactionType.INITIAL_BALANCE
                    : StockTransactionType.RECEIPT,
                responsiblePersonId: row.responsiblePersonId!,
                inventoryItemId,
                quantity: row.parsedQuantity!,
                occurredAt: new Date(),
                sourceDocument: batch.originalFilename,
                comment:
                  batch.type === ImportType.INITIAL_BALANCE
                    ? 'Імпорт початкових залишків'
                    : 'Імпорт надходжень',
                importBatchId: id,
                importRowId: row.id,
                accountingModel: StockAccountingModel.OWNER_CUSTODY,
                bucketKind: StockSourceKind.DIRECT,
                accountingOwnerResponsiblePersonId:
                  row.responsiblePersonId!,
                sourceCustodianResponsiblePersonId:
                  row.responsiblePersonId!,
              });

            await tx.importRow.update({
              where: { id: row.id },
              data: {
                status: ImportRowStatus.IMPORTED,
                inventoryItemId,
                systemBalance: transaction.balanceAfter,
              },
            });
            importedRows += 1;
          }

          await tx.importBatch.update({
            where: { id },
            data: {
              status: ImportStatus.COMPLETED,
              importedRows,
              completedAt: new Date(),
            },
          });
          await this.audit(tx, id, 'COMMIT', true, audit);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      });
    } catch (error) {
      await this.audit(this.prisma, id, 'COMMIT', false, audit, error);
      throw error;
    }

    return this.findOne(id);
  }

  private audit(
    client: Pick<PrismaService, 'securityEvent'> | Prisma.TransactionClient,
    importBatchId: string,
    action: string,
    success: boolean,
    audit?: ImportAudit,
    error?: unknown,
  ) {
    if (!audit) return Promise.resolve();
    return client.securityEvent.create({
      data: {
        type: SecurityEventType.IMPORT_ACTION,
        actorUserId: audit.actor.id,
        requestId: audit.context.requestId,
        ipAddress: audit.context.ipAddress,
        userAgent: audit.context.userAgent,
        success,
        metadata: {
          importBatchId,
          action,
          result: success ? 'SUCCESS' : 'FAILURE',
          reason: error instanceof Error ? error.message : undefined,
        },
      },
    });
  }

  private async enrichRows(rows: ParsedImportRow[], importType: ImportType) {
    const result = [];

    for (const row of rows) {
      const responsiblePerson = await this.findResponsiblePerson(
        row.counterpartyRaw,
      );
      const item = row.nomenclatureCodeRaw
        ? await this.prisma.inventoryItem.findUnique({
            where: { externalCode: row.nomenclatureCodeRaw },
          })
        : null;
      const messages = row.message ? [row.message] : [];
      let status = row.status as ImportRowStatus;
      let systemBalance: Prisma.Decimal | undefined;
      let fileEndingBalance: Prisma.Decimal | undefined;
      let balanceDifference: Prisma.Decimal | undefined;

      if (
        row.status !== 'ERROR' &&
        row.status !== 'SKIPPED' &&
        !responsiblePerson
      ) {
        status = ImportRowStatus.ERROR;
        messages.push('МВО не знайдено');
      }

      if (
        row.status !== 'SKIPPED' &&
        item &&
        item.name.trim() !== row.itemNameRaw.trim()
      ) {
        status =
          status === ImportRowStatus.ERROR ? status : ImportRowStatus.WARNING;
        messages.push(
          `Конфлікт назви номенклатури: у системі "${item.name}", у файлі "${row.itemNameRaw}"`,
        );
      }

      if (
        !item &&
        row.nomenclatureCodeRaw &&
        row.status !== 'ERROR' &&
        row.status !== 'SKIPPED'
      ) {
        status =
          status === ImportRowStatus.ERROR ? status : ImportRowStatus.WARNING;
        messages.push('Нова номенклатура буде створена автоматично');
      }

      if (
        row.status !== 'SKIPPED' &&
        importType === ImportType.RECEIPT &&
        responsiblePerson &&
        row.parsedQuantity &&
        row.endingQuantityRaw
      ) {
        const ending = this.parseOptionalDecimal(row.endingQuantityRaw);
        if (ending && item) {
          const balance = await this.prisma.stockBalance.findUnique({
            where: {
              responsiblePersonId_inventoryItemId: {
                responsiblePersonId: responsiblePerson.id,
                inventoryItemId: item.id,
              },
            },
          });
          systemBalance = (balance?.quantity ?? new Prisma.Decimal(0)).plus(
            row.parsedQuantity,
          );
          fileEndingBalance = ending;
          balanceDifference = ending.minus(systemBalance);
          if (!balanceDifference.equals(0)) {
            status =
              status === ImportRowStatus.ERROR
                ? status
                : ImportRowStatus.WARNING;
            messages.push(
              `Розбіжність кінцевого залишку: ${balanceDifference.toString()}`,
            );
          }
        }
      }

      result.push({
        ...row,
        status,
        responsiblePersonId: responsiblePerson?.id,
        inventoryItemId: item?.id,
        message: messages.filter(Boolean).join('; '),
        systemBalance,
        fileEndingBalance,
        balanceDifference,
      });
    }

    return result;
  }

  private async findResponsiblePerson(counterpartyRaw: string) {
    const externalAccountingCode = this.extractExternalCode(counterpartyRaw);
    return this.prisma.responsiblePerson.findFirst({
      where: {
        OR: [
          { externalAccountingName: counterpartyRaw },
          externalAccountingCode ? { externalAccountingCode } : {},
        ],
      },
    });
  }

  private extractExternalCode(value: string): string | undefined {
    return value.match(/(\d+)\s*$/)?.[1];
  }

  private parseOptionalDecimal(value: string): Prisma.Decimal | undefined {
    try {
      const parsed = this.parser.parseQuantity(value);
      return parsed ? new Prisma.Decimal(parsed) : undefined;
    } catch {
      return undefined;
    }
  }

  private countRows(rows: { status: ImportRowStatus | string }[]) {
    return {
      validRows: rows.filter((row) => row.status === ImportRowStatus.VALID)
        .length,
      warningRows: rows.filter((row) => row.status === ImportRowStatus.WARNING)
        .length,
      errorRows: rows.filter((row) => row.status === ImportRowStatus.ERROR)
        .length,
      skippedRows: rows.filter((row) => row.status === ImportRowStatus.SKIPPED)
        .length,
      importedRows: rows.filter(
        (row) => row.status === ImportRowStatus.IMPORTED,
      ).length,
    };
  }

  private async previewCounters(id: string) {
    const rows = await this.prisma.importRow.findMany({
      where: { importBatchId: id },
    });
    const newItems = rows.filter(
      (row) =>
        !row.inventoryItemId &&
        row.status !== ImportRowStatus.ERROR &&
        row.status !== ImportRowStatus.SKIPPED,
    ).length;
    const matchedPersons = new Set(
      rows
        .filter((row) => row.responsiblePersonId)
        .map((row) => row.counterpartyRaw),
    ).size;
    const missingPersons = new Set(
      rows
        .filter((row) => !row.responsiblePersonId)
        .map((row) => row.counterpartyRaw),
    ).size;

    return {
      ...this.countRows(rows),
      newItems,
      matchedPersons,
      missingPersons,
    };
  }

  private ensureMutable(status: ImportStatus): void {
    const immutableStatuses: ImportStatus[] = [
      ImportStatus.COMPLETED,
      ImportStatus.CANCELLED,
    ];

    if (immutableStatuses.includes(status)) {
      throw new BadRequestException(
        'Завершений або скасований імпорт не можна змінювати',
      );
    }
  }

  private async runSerializable<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new BadRequestException('Не вдалося виконати транзакцію');
  }
}
