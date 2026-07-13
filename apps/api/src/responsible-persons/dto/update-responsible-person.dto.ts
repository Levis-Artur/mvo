import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateResponsiblePersonDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  middleName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  personnelNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  position?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalAccountingName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  externalAccountingCode?: string | null;

  @IsOptional()
  @IsUUID()
  managementId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  appointmentOrderNumber?: string | null;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
