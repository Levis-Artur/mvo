import { IsOptional, IsUUID } from 'class-validator';

export class OperationTargetDto {
  @IsOptional()
  @IsUUID()
  targetResponsiblePersonId?: string;
}
