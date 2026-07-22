import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
} from '@prisma/client';
import { Readable } from 'node:stream';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExportMyPropertyQueryDto,
  ListMyPropertyQueryDto,
  MyPropertyExportSection,
  MyPropertySection,
  MyPropertySortBy,
  SortOrder,
} from './dto/my-property-query.dto';
import { csvPreamble, csvRow } from './my-property.csv';

const inventoryItemSelect = {
  id: true,
  externalCode: true,
  name: true,
  unitOfMeasure: true,
} satisfies Prisma.InventoryItemSelect;

const recipientSelect = {
  id: true,
  lastName: true,
  firstName: true,
  middleName: true,
  personnelNumber: true,
} satisfies Prisma.ResponsiblePersonSelect;

const directPropertySelect = {
  id: true,
  quantity: true,
  updatedAt: true,
  inventoryItem: { select: inventoryItemSelect },
} satisfies Prisma.StockBalanceSelect;

const transferHistorySelect = {
  id: true,
  quantity: true,
  inventoryItem: { select: inventoryItemSelect },
  document: {
    select: {
      id: true,
      displayNumber: true,
      documentDate: true,
      type: true,
      status: true,
      destinationResponsiblePerson: { select: recipientSelect },
    },
  },
} satisfies Prisma.StockDocumentLineSelect;

type DirectPropertyRow = Prisma.StockBalanceGetPayload<{
  select: typeof directPropertySelect;
}>;
type TransferHistoryRow = Prisma.StockDocumentLineGetPayload<{
  select: typeof transferHistorySelect;
}>;
type DirectPropertyItem = ReturnType<MyPropertyService['serializeDirect']>;
type TransferHistoryItem = ReturnType<
  MyPropertyService['serializeTransferHistory']
>;
type PropertyItem = DirectPropertyItem | TransferHistoryItem;

const EXPORT_BATCH_SIZE = 500;
const historicalTransferTypes = [
  StockDocumentType.TRANSFER,
  StockDocumentType.ASSIGNMENT,
  StockDocumentType.MVO_TRANSFER,
];
const historicalTransferStatuses = [
  StockDocumentStatus.DRAFT,
  StockDocumentStatus.POSTED,
  StockDocumentStatus.CANCELLED,
];

@Injectable()
export class MyPropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMyPropertyQueryDto, user: CurrentUser) {
    const responsiblePersonId = this.requireMvoScope(user);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const search = query.search?.trim();
    const section = query.section ?? MyPropertySection.DIRECT;

    return section === MyPropertySection.DIRECT
      ? this.listDirect(responsiblePersonId, search, query, page, limit)
      : this.listTransferHistory(
          responsiblePersonId,
          search,
          query,
          page,
          limit,
        );
  }

  async exportCsv(query: ExportMyPropertyQueryDto, user: CurrentUser) {
    const responsiblePersonId = this.requireMvoScope(user);
    const responsiblePerson = await this.prisma.responsiblePerson.findUnique({
      where: { id: responsiblePersonId },
      select: { personnelNumber: true },
    });
    if (!responsiblePerson) {
      throw new BadRequestException(
        'Картку МВО поточного користувача не знайдено',
      );
    }

    const date = new Date().toISOString().slice(0, 10);
    const personnelNumber = responsiblePerson.personnelNumber.replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    return {
      filename: `mvo-property-${personnelNumber}-${date}.csv`,
      stream: Readable.from(
        this.csvChunks(
          responsiblePersonId,
          query.search?.trim(),
          query.section ?? MyPropertyExportSection.ALL,
        ),
      ),
    };
  }

  private async listDirect(
    responsiblePersonId: string,
    search: string | undefined,
    query: ListMyPropertyQueryDto,
    page: number,
    limit: number,
  ) {
    const where = this.directWhere(responsiblePersonId, search);
    const [items, total] = await Promise.all([
      this.prisma.stockBalance.findMany({
        where,
        select: directPropertySelect,
        orderBy: this.directOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockBalance.count({ where }),
    ]);
    return this.paginated(
      items.map((item) => this.serializeDirect(item)),
      page,
      limit,
      total,
    );
  }

  private async listTransferHistory(
    responsiblePersonId: string,
    search: string | undefined,
    query: ListMyPropertyQueryDto,
    page: number,
    limit: number,
  ) {
    const where = this.transferHistoryWhere(responsiblePersonId, search);
    const [items, total] = await Promise.all([
      this.prisma.stockDocumentLine.findMany({
        where,
        select: transferHistorySelect,
        orderBy: this.transferHistoryOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockDocumentLine.count({ where }),
    ]);
    return this.paginated(
      items.map((item) => this.serializeTransferHistory(item)),
      page,
      limit,
      total,
    );
  }

  private directWhere(
    responsiblePersonId: string,
    search?: string,
  ): Prisma.StockBalanceWhereInput {
    const terms = this.searchTerms(search);
    return {
      responsiblePersonId,
      quantity: { gt: 0 },
      AND: terms.map((term) => ({
        OR: [
          {
            inventoryItem: {
              externalCode: { contains: term, mode: 'insensitive' },
            },
          },
          {
            inventoryItem: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        ],
      })),
    };
  }

  private transferHistoryWhere(
    responsiblePersonId: string,
    search?: string,
  ): Prisma.StockDocumentLineWhereInput {
    const terms = this.searchTerms(search);
    return {
      document: {
        sourceResponsiblePersonId: responsiblePersonId,
        type: { in: historicalTransferTypes },
        status: { in: historicalTransferStatuses },
      },
      AND: terms.map((term) => {
        const displayNumber = /^\d+$/.test(term) ? Number(term) : undefined;
        return {
          OR: [
            {
              inventoryItem: {
                externalCode: { contains: term, mode: 'insensitive' },
              },
            },
            {
              inventoryItem: {
                name: { contains: term, mode: 'insensitive' },
              },
            },
            {
              document: {
                documentNumber: { contains: term, mode: 'insensitive' },
              },
            },
            ...(displayNumber
              ? [{ document: { displayNumber } }]
              : []),
            {
              document: {
                destinationResponsiblePerson: {
                  personnelNumber: { contains: term, mode: 'insensitive' },
                },
              },
            },
            {
              document: {
                destinationResponsiblePerson: {
                  lastName: { contains: term, mode: 'insensitive' },
                },
              },
            },
            {
              document: {
                destinationResponsiblePerson: {
                  firstName: { contains: term, mode: 'insensitive' },
                },
              },
            },
            {
              document: {
                destinationResponsiblePerson: {
                  middleName: { contains: term, mode: 'insensitive' },
                },
              },
            },
          ],
        };
      }),
    };
  }

  private directOrderBy(
    sortBy = MyPropertySortBy.NAME,
    sortOrder = SortOrder.ASC,
  ): Prisma.StockBalanceOrderByWithRelationInput[] {
    const primary: Prisma.StockBalanceOrderByWithRelationInput =
      sortBy === MyPropertySortBy.CODE
        ? { inventoryItem: { externalCode: sortOrder } }
        : sortBy === MyPropertySortBy.QUANTITY
          ? { quantity: sortOrder }
          : { inventoryItem: { name: sortOrder } };
    return [primary, { id: SortOrder.ASC }];
  }

  private transferHistoryOrderBy(
    sortBy = MyPropertySortBy.DOCUMENT_DATE,
    sortOrder = SortOrder.DESC,
  ): Prisma.StockDocumentLineOrderByWithRelationInput[] {
    const primary: Prisma.StockDocumentLineOrderByWithRelationInput =
      sortBy === MyPropertySortBy.CODE
        ? { inventoryItem: { externalCode: sortOrder } }
        : sortBy === MyPropertySortBy.NAME
          ? { inventoryItem: { name: sortOrder } }
          : sortBy === MyPropertySortBy.QUANTITY
            ? { quantity: sortOrder }
            : sortBy === MyPropertySortBy.DOCUMENT_NUMBER
              ? { document: { displayNumber: sortOrder } }
              : sortBy === MyPropertySortBy.RECIPIENT
                ? {
                    document: {
                      destinationResponsiblePerson: { lastName: sortOrder },
                    },
                  }
                : { document: { documentDate: sortOrder } };
    return [primary, { id: SortOrder.ASC }];
  }

  serializeDirect(row: DirectPropertyRow) {
    return {
      section: MyPropertySection.DIRECT as const,
      id: row.id,
      inventoryItem: row.inventoryItem,
      quantity: row.quantity.toString(),
      updatedAt: row.updatedAt,
    };
  }

  serializeTransferHistory(row: TransferHistoryRow) {
    const recipient = row.document.destinationResponsiblePerson;
    return {
      section: MyPropertySection.TRANSFERRED as const,
      id: row.id,
      inventoryItem: row.inventoryItem,
      quantity: row.quantity.toString(),
      document: {
        id: row.document.id,
        displayNumber: row.document.displayNumber,
        documentDate: row.document.documentDate,
        type: row.document.type,
        status: row.document.status,
      },
      recipient: recipient
        ? {
            id: recipient.id,
            personnelNumber: recipient.personnelNumber,
            fullName: [
              recipient.lastName,
              recipient.firstName,
              recipient.middleName,
            ]
              .filter(Boolean)
              .join(' '),
          }
        : null,
    };
  }

  private paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
  ) {
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private searchTerms(search?: string) {
    return search?.trim().split(/\s+/u).filter(Boolean).slice(0, 10) ?? [];
  }

  private requireMvoScope(user: CurrentUser) {
    if (!user.responsiblePersonId) {
      throw new BadRequestException(
        'Моє майно доступне лише користувачу з прив’язаною карткою МВО',
      );
    }
    return user.responsiblePersonId;
  }

  private async *csvChunks(
    responsiblePersonId: string,
    search: string | undefined,
    section: MyPropertyExportSection,
  ): AsyncGenerator<string> {
    yield csvPreamble();
    for (const currentSection of this.exportSections(section)) {
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const rows =
          currentSection === MyPropertySection.DIRECT
            ? await this.prisma.stockBalance
                .findMany({
                  where: this.directWhere(responsiblePersonId, search),
                  select: directPropertySelect,
                  orderBy: { id: SortOrder.ASC },
                  take: EXPORT_BATCH_SIZE,
                  cursor: cursor ? { id: cursor } : undefined,
                  skip: cursor ? 1 : undefined,
                })
                .then((items) =>
                  items.map((item) => this.serializeDirect(item)),
                )
            : await this.prisma.stockDocumentLine
                .findMany({
                  where: this.transferHistoryWhere(
                    responsiblePersonId,
                    search,
                  ),
                  select: transferHistorySelect,
                  orderBy: { id: SortOrder.ASC },
                  take: EXPORT_BATCH_SIZE,
                  cursor: cursor ? { id: cursor } : undefined,
                  skip: cursor ? 1 : undefined,
                })
                .then((items) =>
                  items.map((item) => this.serializeTransferHistory(item)),
                );

        for (const row of rows) yield this.csvPropertyRow(row);
        cursor = rows[rows.length - 1]?.id;
        hasMore = rows.length === EXPORT_BATCH_SIZE && Boolean(cursor);
      }
    }
  }

  private csvPropertyRow(row: PropertyItem) {
    if (row.section === MyPropertySection.DIRECT) {
      return csvRow(
        [
          'У мене',
          row.inventoryItem.externalCode,
          row.inventoryItem.name,
          row.inventoryItem.unitOfMeasure ?? '',
          row.quantity,
          '',
          '',
          '',
          '',
        ],
        [1],
      );
    }
    return csvRow(
      [
        'Передано іншим МВО',
        row.inventoryItem.externalCode,
        row.inventoryItem.name,
        row.inventoryItem.unitOfMeasure ?? '',
        row.quantity,
        row.document.displayNumber,
        row.document.documentDate.toISOString(),
        row.recipient?.fullName ?? '',
        row.document.status,
      ],
      [1],
    );
  }

  private exportSections(
    section: MyPropertyExportSection,
  ): MyPropertySection[] {
    if (section === MyPropertyExportSection.ALL) {
      return [MyPropertySection.DIRECT, MyPropertySection.TRANSFERRED];
    }
    return section === MyPropertyExportSection.DIRECT
      ? [MyPropertySection.DIRECT]
      : [MyPropertySection.TRANSFERRED];
  }
}
