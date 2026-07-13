import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateResponsiblePersonDto {
  @IsString()
  @MaxLength(120)
  lastName!: string;

  @IsString()
  @MaxLength(120)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string;

  @IsString()
  @MaxLength(80)
  personnelNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalAccountingName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalAccountingCode?: string;

  @IsUUID()
  managementId!: string;

  @IsUUID()
  serviceId!: string;

  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  appointmentOrderNumber?: string;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
