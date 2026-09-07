import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ReadAccessPaginationQueryDto } from '../../auth/dto/read-access-query.dto';
import { parseBooleanQuery } from '../../common/dto/active-query.dto';

export class ListStockBalancesQueryDto extends ReadAccessPaginationQueryDto {
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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  serviceCode?: string;

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
