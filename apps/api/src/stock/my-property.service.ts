import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockSourceKind } from '@prisma/client';
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

const propertyPersonSelect = {
  id: true,
  lastName: true,
  firstName: true,
  middleName: true,
  personnelNumber: true,
  management: { select: { name: true } },
  service: { select: { name: true } },
  unit: { select: { name: true } },
} satisfies Prisma.ResponsiblePersonSelect;

const directPropertySelect = {
  id: true,
  quantity: true,
  updatedAt: true,
  inventoryItem: { select: inventoryItemSelect },
  responsiblePerson: { select: propertyPersonSelect },
} satisfies Prisma.StockBalanceSelect;

const custodyPropertySelect = {
  id: true,
  quantity: true,
  updatedAt: true,
  inventoryItem: { select: inventoryItemSelect },
  accountingOwnerResponsiblePerson: { select: propertyPersonSelect },
  custodianResponsiblePerson: { select: propertyPersonSelect },
} satisfies Prisma.CustodyBalanceSelect;

type DirectPropertyRow = Prisma.StockBalanceGetPayload<{
  select: typeof directPropertySelect;
}>;
type CustodyPropertyRow = Prisma.CustodyBalanceGetPayload<{
  select: typeof custodyPropertySelect;
}>;
type PropertyPerson = DirectPropertyRow['responsiblePerson'];
type PropertyPersonView = {
  id: string;
  personnelNumber: string;
  fullName: string;
  management: string | null;
  service: string | null;
  unit: string | null;
};
type PropertyRow = {
  section: MyPropertySection;
  sourceKind: StockSourceKind;
  sourceBalanceId: string;
  inventoryItem: DirectPropertyRow['inventoryItem'];
  accountingOwner: PropertyPersonView;
  currentCustodian: PropertyPersonView;
  quantity: string;
  canAssign: boolean;
  canIssue: boolean;
  updatedAt: Date;
};

const EXPORT_BATCH_SIZE = 500;

@Injectable()
export class MyPropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListMyPropertyQueryDto, user: CurrentUser) {
    const responsiblePersonId = this.requireMvoScope(user);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const search = query.search?.trim();
    const section = query.section ?? MyPropertySection.DIRECT;

    const [result, summary] = await Promise.all([
      section === MyPropertySection.DIRECT
        ? this.listDirect(responsiblePersonId, search, query, page, limit)
        : this.listCustody(responsiblePersonId, search, section, query, page, limit),
      this.summary(responsiblePersonId),
    ]);

    return { ...result, summary };
  }

  async exportCsv(query: ExportMyPropertyQueryDto, user: CurrentUser) {
    const responsiblePersonId = this.requireMvoScope(user);
    const responsiblePerson = await this.prisma.responsiblePerson.findUnique({
      where: { id: responsiblePersonId },
      select: { personnelNumber: true },
    });
    if (!responsiblePerson) {
      throw new BadRequestException('Картку МВО поточного користувача не знайдено');
    }

    const date = new Date().toISOString().slice(0, 10);
    const personnelNumber = responsiblePerson.personnelNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      filename: `mvo-property-${personnelNumber}-${date}.csv`,
      stream: Readable.from(this.csvChunks(
        responsiblePersonId,
        query.search?.trim(),
        query.section ?? MyPropertyExportSection.ALL,
      )),
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

  private async listCustody(
    responsiblePersonId: string,
    search: string | undefined,
    section: MyPropertySection,
    query: ListMyPropertyQueryDto,
    page: number,
    limit: number,
  ) {
    const where = this.custodyWhere(responsiblePersonId, section, search);
    const [items, total] = await Promise.all([
      this.prisma.custodyBalance.findMany({
        where,
        select: custodyPropertySelect,
        orderBy: this.custodyOrderBy(query.sortBy, query.sortOrder),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.custodyBalance.count({ where }),
    ]);
    return this.paginated(
      items.map((item) => this.serializeCustody(item, section)),
      page,
      limit,
      total,
    );
  }

  private async summary(responsiblePersonId: string) {
    const [direct, assignedOut, assignedToMe] = await Promise.all([
      this.prisma.stockBalance.aggregate({
        where: { responsiblePersonId, quantity: { gt: 0 } },
        _sum: { quantity: true },
        _count: true,
      }),
      this.prisma.custodyBalance.aggregate({
        where: { accountingOwnerResponsiblePersonId: responsiblePersonId, quantity: { gt: 0 } },
        _sum: { quantity: true },
        _count: true,
      }),
      this.prisma.custodyBalance.aggregate({
        where: { custodianResponsiblePersonId: responsiblePersonId, quantity: { gt: 0 } },
        _sum: { quantity: true },
        _count: true,
      }),
    ]);
    const directQuantity = new Prisma.Decimal(direct._sum.quantity ?? 0);
    const assignedOutQuantity = new Prisma.Decimal(assignedOut._sum.quantity ?? 0);
    const assignedToMeQuantity = new Prisma.Decimal(assignedToMe._sum.quantity ?? 0);
    return {
      directCount: direct._count,
      assignedOutCount: assignedOut._count,
      assignedToMeCount: assignedToMe._count,
      directQuantity: directQuantity.toString(),
      assignedOutQuantity: assignedOutQuantity.toString(),
      assignedToMeQuantity: assignedToMeQuantity.toString(),
      totalOwnedAccountingQuantity: directQuantity.plus(assignedOutQuantity).toString(),
      totalPhysicallyHeldQuantity: directQuantity.plus(assignedToMeQuantity).toString(),
    };
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
          { inventoryItem: { externalCode: { contains: term, mode: 'insensitive' } } },
          { inventoryItem: { name: { contains: term, mode: 'insensitive' } } },
          { responsiblePerson: { personnelNumber: { contains: term, mode: 'insensitive' } } },
          { responsiblePerson: { lastName: { contains: term, mode: 'insensitive' } } },
          { responsiblePerson: { firstName: { contains: term, mode: 'insensitive' } } },
          { responsiblePerson: { middleName: { contains: term, mode: 'insensitive' } } },
        ],
      })),
    };
  }

  private custodyWhere(
    responsiblePersonId: string,
    section: MyPropertySection | MyPropertyExportSection,
    search?: string,
  ): Prisma.CustodyBalanceWhereInput {
    const terms = this.searchTerms(search);
    return {
      accountingOwnerResponsiblePersonId:
        section === MyPropertySection.ASSIGNED_OUT ? responsiblePersonId : undefined,
      custodianResponsiblePersonId:
        section === MyPropertySection.ASSIGNED_TO_ME ? responsiblePersonId : undefined,
      quantity: { gt: 0 },
      AND: terms.map((term) => ({
        OR: [
          { inventoryItem: { externalCode: { contains: term, mode: 'insensitive' } } },
          { inventoryItem: { name: { contains: term, mode: 'insensitive' } } },
          { accountingOwnerResponsiblePerson: { personnelNumber: { contains: term, mode: 'insensitive' } } },
          { accountingOwnerResponsiblePerson: { lastName: { contains: term, mode: 'insensitive' } } },
          { accountingOwnerResponsiblePerson: { firstName: { contains: term, mode: 'insensitive' } } },
          { accountingOwnerResponsiblePerson: { middleName: { contains: term, mode: 'insensitive' } } },
          { custodianResponsiblePerson: { personnelNumber: { contains: term, mode: 'insensitive' } } },
          { custodianResponsiblePerson: { lastName: { contains: term, mode: 'insensitive' } } },
          { custodianResponsiblePerson: { firstName: { contains: term, mode: 'insensitive' } } },
          { custodianResponsiblePerson: { middleName: { contains: term, mode: 'insensitive' } } },
        ],
      })),
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
          : sortBy === MyPropertySortBy.ACCOUNTING_OWNER || sortBy === MyPropertySortBy.CURRENT_CUSTODIAN
            ? { responsiblePerson: { lastName: sortOrder } }
            : { inventoryItem: { name: sortOrder } };
    return [primary, { id: SortOrder.ASC }];
  }

  private custodyOrderBy(
    sortBy = MyPropertySortBy.NAME,
    sortOrder = SortOrder.ASC,
  ): Prisma.CustodyBalanceOrderByWithRelationInput[] {
    const primary: Prisma.CustodyBalanceOrderByWithRelationInput =
      sortBy === MyPropertySortBy.CODE
        ? { inventoryItem: { externalCode: sortOrder } }
        : sortBy === MyPropertySortBy.QUANTITY
          ? { quantity: sortOrder }
          : sortBy === MyPropertySortBy.ACCOUNTING_OWNER
            ? { accountingOwnerResponsiblePerson: { lastName: sortOrder } }
            : sortBy === MyPropertySortBy.CURRENT_CUSTODIAN
              ? { custodianResponsiblePerson: { lastName: sortOrder } }
              : { inventoryItem: { name: sortOrder } };
    return [primary, { id: SortOrder.ASC }];
  }

  private serializeDirect(row: DirectPropertyRow) {
    const person = this.serializePerson(row.responsiblePerson);
    return {
      section: MyPropertySection.DIRECT,
      sourceKind: StockSourceKind.DIRECT,
      sourceBalanceId: row.id,
      inventoryItem: row.inventoryItem,
      accountingOwner: person,
      currentCustodian: person,
      quantity: row.quantity.toString(),
      canAssign: true,
      canIssue: true,
      updatedAt: row.updatedAt,
    };
  }

  private serializeCustody(row: CustodyPropertyRow, section: MyPropertySection) {
    const actionable = section === MyPropertySection.ASSIGNED_TO_ME;
    return {
      section,
      sourceKind: StockSourceKind.ASSIGNED,
      sourceBalanceId: row.id,
      inventoryItem: row.inventoryItem,
      accountingOwner: this.serializePerson(row.accountingOwnerResponsiblePerson),
      currentCustodian: this.serializePerson(row.custodianResponsiblePerson),
      quantity: row.quantity.toString(),
      canAssign: actionable,
      canIssue: actionable,
      updatedAt: row.updatedAt,
    };
  }

  private serializePerson(person: PropertyPerson) {
    return {
      id: person.id,
      personnelNumber: person.personnelNumber,
      fullName: [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' '),
      management: person.management?.name ?? null,
      service: person.service?.name ?? null,
      unit: person.unit?.name ?? null,
    };
  }

  private paginated(items: PropertyRow[], page: number, limit: number, total: number) {
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    const sections = this.exportSections(section);

    for (const currentSection of sections) {
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const rows = currentSection === MyPropertySection.DIRECT
          ? await this.prisma.stockBalance.findMany({
              where: this.directWhere(responsiblePersonId, search),
              select: directPropertySelect,
              orderBy: { id: SortOrder.ASC },
              take: EXPORT_BATCH_SIZE,
              cursor: cursor ? { id: cursor } : undefined,
              skip: cursor ? 1 : undefined,
            }).then((items) => items.map((item) => this.serializeDirect(item)))
          : await this.prisma.custodyBalance.findMany({
              where: this.custodyWhere(responsiblePersonId, currentSection, search),
              select: custodyPropertySelect,
              orderBy: { id: SortOrder.ASC },
              take: EXPORT_BATCH_SIZE,
              cursor: cursor ? { id: cursor } : undefined,
              skip: cursor ? 1 : undefined,
            }).then((items) => items.map((item) => this.serializeCustody(item, currentSection)));

        for (const row of rows) yield this.csvPropertyRow(row);
        cursor = rows[rows.length - 1]?.sourceBalanceId;
        hasMore = rows.length === EXPORT_BATCH_SIZE && Boolean(cursor);
      }
    }
  }

  private csvPropertyRow(row: PropertyRow) {
    const category = row.section === MyPropertySection.DIRECT
      ? 'Безпосередньо у мене'
      : row.section === MyPropertySection.ASSIGNED_OUT
        ? 'Закріплено за іншими'
        : 'Закріплено за мною';
    return csvRow([
      category,
      row.inventoryItem.externalCode,
      row.inventoryItem.name,
      row.inventoryItem.unitOfMeasure ?? '',
      row.sourceKind === StockSourceKind.DIRECT ? 'Прямий залишок' : 'Закріплене майно',
      row.accountingOwner.personnelNumber,
      row.accountingOwner.fullName,
      row.accountingOwner.management ?? '',
      row.accountingOwner.service ?? '',
      row.accountingOwner.unit ?? '',
      row.currentCustodian.personnelNumber,
      row.currentCustodian.fullName,
      row.currentCustodian.management ?? '',
      row.currentCustodian.service ?? '',
      row.currentCustodian.unit ?? '',
      row.quantity,
      row.canAssign ? 'Так' : 'Ні',
      row.canIssue ? 'Так' : 'Ні',
      row.updatedAt.toISOString(),
    ], [1, 5, 10]);
  }

  private exportSections(section: MyPropertyExportSection): MyPropertySection[] {
    if (section === MyPropertyExportSection.ALL) {
      return [
        MyPropertySection.DIRECT,
        MyPropertySection.ASSIGNED_OUT,
        MyPropertySection.ASSIGNED_TO_ME,
      ];
    }
    if (section === MyPropertyExportSection.DIRECT) return [MyPropertySection.DIRECT];
    if (section === MyPropertyExportSection.ASSIGNED_OUT) return [MyPropertySection.ASSIGNED_OUT];
    return [MyPropertySection.ASSIGNED_TO_ME];
  }
}
