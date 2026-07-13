import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ManualReceiptDto {
  @IsUUID()
  responsiblePersonId!: string;

  @IsUUID()
  inventoryItemId!: string;

  @IsString()
  quantity!: string;

  @IsDateString()
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceDocument?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
