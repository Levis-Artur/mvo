import {
  StockDocumentStatus,
  StockDocumentType,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class StockDocumentLineDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsString()
  quantity!: string;

  @IsOptional()
  @IsUUID()
  sourceBalanceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CreateStockDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @IsDateString()
  documentDate!: string;

  @IsEnum(StockDocumentType)
  type!: StockDocumentType;

  @IsUUID()
  sourceResponsiblePersonId!: string;

  @IsOptional()
  @IsUUID()
  destinationResponsiblePersonId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  basis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockDocumentLineDto)
  lines!: StockDocumentLineDto[];
}

export class CreateMvoTransferDto {
  @IsDateString()
  documentDate!: string;

  @IsUUID()
  destinationResponsiblePersonId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockDocumentLineDto)
  lines!: StockDocumentLineDto[];
}

export class CreateIssueDto {
  @IsDateString()
  documentDate!: string;

  @IsString()
  @MaxLength(255)
  recipientName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed)
        ? parsed.map((line) =>
            Object.assign(new StockDocumentLineDto(), line),
          )
        : parsed;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockDocumentLineDto)
  lines!: StockDocumentLineDto[];
}

export class UpdateStockDocumentDto extends CreateStockDocumentDto {}

export class ListStockDocumentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StockDocumentType)
  type?: StockDocumentType;

  @IsOptional()
  @IsEnum(StockDocumentStatus)
  status?: StockDocumentStatus;

  @IsOptional()
  @IsUUID()
  sourceResponsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  destinationResponsiblePersonId?: string;

  @IsOptional()
  @IsDateString()
  documentDateFrom?: string;

  @IsOptional()
  @IsDateString()
  documentDateTo?: string;
}
