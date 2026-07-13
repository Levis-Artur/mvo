import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { StockTransactionType } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListStockTransactionsQueryDto extends PaginationQueryDto {
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
