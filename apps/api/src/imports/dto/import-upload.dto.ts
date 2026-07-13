import { ImportType } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ImportUploadDto {
  @IsEnum(ImportType)
  importType!: ImportType;
}
