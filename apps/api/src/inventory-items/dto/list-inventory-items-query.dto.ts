import { InventoryItemReviewStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { parseBooleanQuery } from '../../common/dto/active-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListInventoryItemsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(InventoryItemReviewStatus)
  reviewStatus?: InventoryItemReviewStatus;

  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) =>
    parseBooleanQuery(value),
  )
  @IsBoolean()
  isActive?: boolean;
}
