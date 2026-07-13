import { IsOptional, IsUUID } from 'class-validator';

export class ListUnitsQueryDto {
  @IsOptional()
  @IsUUID()
  managementId?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
