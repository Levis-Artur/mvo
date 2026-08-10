import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ACCOUNTING_MOVEMENT_TYPES = [
  'IMPORT',
  'MVO_TRANSFER',
  'ISSUE',
] as const;

export type AccountingMovementType =
  (typeof ACCOUNTING_MOVEMENT_TYPES)[number];

export const ACCOUNTING_MOVEMENT_STATUSES = [
  'POSTED',
  'CANCELLED',
  'COMPLETED',
] as const;

export type AccountingMovementStatus =
  (typeof ACCOUNTING_MOVEMENT_STATUSES)[number];

export class AccountingMovementFiltersDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(ACCOUNTING_MOVEMENT_TYPES)
  operationType?: AccountingMovementType;

  @IsOptional()
  @IsUUID()
  responsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  destinationResponsiblePersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mvoCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  inventoryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inventoryName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  transferRecipient?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  issueRecipient?: string;

  @IsOptional()
  @IsIn(ACCOUNTING_MOVEMENT_STATUSES)
  status?: AccountingMovementStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class ListAccountingMovementsQueryDto extends AccountingMovementFiltersDto {
  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 25 : Number(value),
  )
  @IsInt()
  @Min(25)
  @Max(100)
  @IsIn([25, 50, 100])
  limit = 25;
}
