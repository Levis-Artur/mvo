import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export enum MyPropertySection {
  DIRECT = 'DIRECT',
  ASSIGNED_OUT = 'ASSIGNED_OUT',
  ASSIGNED_TO_ME = 'ASSIGNED_TO_ME',
}

export enum MyPropertyExportSection {
  ALL = 'ALL',
  DIRECT = 'DIRECT',
  ASSIGNED_OUT = 'ASSIGNED_OUT',
  ASSIGNED_TO_ME = 'ASSIGNED_TO_ME',
}

export enum MyPropertySortBy {
  CODE = 'code',
  NAME = 'name',
  QUANTITY = 'quantity',
  ACCOUNTING_OWNER = 'accountingOwner',
  CURRENT_CUSTODIAN = 'currentCustodian',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListMyPropertyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(MyPropertySection)
  section: MyPropertySection = MyPropertySection.DIRECT;

  @IsOptional()
  @IsEnum(MyPropertySortBy)
  sortBy: MyPropertySortBy = MyPropertySortBy.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}

export class ExportMyPropertyQueryDto {
  @IsOptional()
  @Transform(({ value }: { value?: string }) => value?.trim())
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(MyPropertyExportSection)
  section: MyPropertyExportSection = MyPropertyExportSection.ALL;
}
