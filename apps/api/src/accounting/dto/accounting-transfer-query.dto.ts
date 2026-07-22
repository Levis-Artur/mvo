import { AccountingExportState, StockDocumentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AccountingTransferFiltersDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  sourceResponsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  destinationResponsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsEnum(StockDocumentStatus)
  status?: StockDocumentStatus;

  @IsOptional()
  @IsEnum(AccountingExportState)
  exportState?: AccountingExportState;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;
}

export class ListAccountingTransfersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsUUID()
  sourceResponsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  destinationResponsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsEnum(StockDocumentStatus)
  status?: StockDocumentStatus;

  @IsOptional()
  @IsEnum(AccountingExportState)
  exportState?: AccountingExportState;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;
}

export class ListAccountingExportBatchesQueryDto extends PaginationQueryDto {}
