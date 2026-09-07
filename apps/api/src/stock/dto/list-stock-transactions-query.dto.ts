import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { StockTransactionType } from '@prisma/client';
import { ReadAccessPaginationQueryDto } from '../../auth/dto/read-access-query.dto';

export class ListStockTransactionsQueryDto extends ReadAccessPaginationQueryDto {
  @IsOptional()
  @IsUUID()
  responsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  type?: StockTransactionType;

  @IsOptional()
  @IsUUID()
  importBatchId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
