import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class IssueRealizationLineDto {
  @IsUUID()
  issueLineId!: string;

  @IsString()
  quantity!: string;
}

export class CreateIssueRealizationDto {
  @IsDateString()
  realizationDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  recipientText?: string;

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
            Object.assign(new IssueRealizationLineDto(), line),
          )
        : parsed;
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueRealizationLineDto)
  lines!: IssueRealizationLineDto[];
}

export class ListIssueRealizationsQueryDto extends PaginationQueryDto {}
