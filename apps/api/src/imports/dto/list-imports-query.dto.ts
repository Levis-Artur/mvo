import { ImportStatus, ImportType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListImportsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ImportType)
  type?: ImportType;

  @IsOptional()
  @IsEnum(ImportStatus)
  status?: ImportStatus;
}
