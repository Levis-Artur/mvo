import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateManagementDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
