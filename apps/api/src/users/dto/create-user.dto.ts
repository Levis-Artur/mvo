import { UserRole } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  username!: string;

  @IsIn([UserRole.ACCOUNTANT, UserRole.ORG_MANAGER, UserRole.MVO])
  @IsOptional()
  role?: UserRole;

  @IsUUID()
  @IsOptional()
  responsiblePersonId?: string;
}
