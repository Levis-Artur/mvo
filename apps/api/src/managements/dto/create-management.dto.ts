import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateManagementDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortName?: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
