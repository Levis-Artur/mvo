import { InventoryItemReviewStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @MaxLength(120)
  externalCode!: string;

  @IsString()
  @MaxLength(500)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  unitOfMeasure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(InventoryItemReviewStatus)
  reviewStatus?: InventoryItemReviewStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
