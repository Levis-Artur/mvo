import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { parseBooleanQuery } from '../../common/dto/active-query.dto';

export class ListStockBalancesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  responsiblePersonId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsUUID()
  managementId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) =>
    parseBooleanQuery(value),
  )
  @IsBoolean()
  onlyPositive?: boolean;
}
