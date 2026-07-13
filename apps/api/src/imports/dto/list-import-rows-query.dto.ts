import { ImportRowStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListImportRowsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportRowStatus)
  status?: ImportRowStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
