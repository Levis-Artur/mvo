import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class DestructiveActionDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsString()
  confirmation!: string;
}

export class ResetTestDataDto {
  @IsIn(['DELETE TEST DATA'])
  confirmation!: 'DELETE TEST DATA';
}
