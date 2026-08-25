import { IsString, MaxLength, MinLength } from 'class-validator';

export class PreAuthTwoFactorEnrollDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  preAuthToken!: string;
}
