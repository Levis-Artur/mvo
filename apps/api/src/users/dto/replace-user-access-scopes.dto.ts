import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UserAccessScopeDto {
  @IsUUID()
  @IsOptional()
  managementId?: string | null;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  serviceCode?: string | null;
}

export class ReplaceUserAccessScopesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UserAccessScopeDto)
  scopes!: UserAccessScopeDto[];
}
