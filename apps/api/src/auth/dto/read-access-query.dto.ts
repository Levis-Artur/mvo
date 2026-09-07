import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export type ReadAccessMode = 'SELF_ONLY' | 'SCOPED_READ';

export class ReadAccessQueryDto {
  @IsOptional()
  @IsIn(['SELF_ONLY', 'SCOPED_READ'])
  accessMode?: ReadAccessMode;
}

export class ReadAccessPaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['SELF_ONLY', 'SCOPED_READ'])
  accessMode?: ReadAccessMode;
}
