import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ImportMappingDto {
  @IsString()
  counterpartyRaw!: string;

  @IsUUID()
  responsiblePersonId!: string;

  @IsOptional()
  @IsBoolean()
  saveExternalAccountingName?: boolean;
}

export class UpdateImportMappingsDto {
  @IsArray()
  mappings!: ImportMappingDto[];
}
