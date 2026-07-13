import { InventoryItemReviewStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsEnum(InventoryItemReviewStatus)
  reviewStatus?: InventoryItemReviewStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
