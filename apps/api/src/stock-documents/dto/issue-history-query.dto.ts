import { StockDocumentStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { parseBooleanQuery } from '../../common/dto/active-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class IssueHistoryFiltersDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  override page = 1;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 25 : Number(value),
  )
  @IsInt()
  @IsIn([25, 50, 100])
  override limit = 25;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  displayNumber?: number;

  @IsOptional()
  @IsUUID()
  sourceResponsiblePersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  externalAccountingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  inventoryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  inventoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipient?: string;

  @IsOptional()
  @IsEnum(StockDocumentStatus)
  status?: StockDocumentStatus;

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value))
  @IsBoolean()
  hasAttachment?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class ListIssueHistoryQueryDto extends IssueHistoryFiltersDto {}
