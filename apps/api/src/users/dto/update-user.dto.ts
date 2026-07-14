import { UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @IsOptional()
  username?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsUUID()
  @IsOptional()
  responsiblePersonId?: string | null;

  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}

