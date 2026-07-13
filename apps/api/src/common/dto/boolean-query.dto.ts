import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class BooleanQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) => {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isActive?: boolean;
}
