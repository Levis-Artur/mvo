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

export const INVENTORY_MOVEMENT_CATEGORIES = [
  'IMPORT',
  'MANUAL_RECEIPT',
  'MVO_TRANSFER',
  'ISSUE',
  'MVO_TRANSFER_REVERSAL',
  'ISSUE_REVERSAL',
  'LEGACY',
] as const;

export type InventoryMovementCategory =
  (typeof INVENTORY_MOVEMENT_CATEGORIES)[number];

export class InventoryMovementFiltersDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn(INVENTORY_MOVEMENT_CATEGORIES)
  movementType?: InventoryMovementCategory;

  @IsOptional()
  @IsUUID()
  responsiblePersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;
}

export class InventoryItemAccountingCardQueryDto extends InventoryMovementFiltersDto {
  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  movementPage = 1;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 20 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  movementLimit = 20;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 1 : Number(value),
  )
  @IsInt()
  @Min(1)
  documentPage = 1;

  @IsOptional()
  @Transform(({ value }: { value: string | number | undefined }) =>
    value === undefined || value === '' ? 20 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  documentLimit = 20;
}
