import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PreAuthTwoFactorConfirmDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  preAuthToken!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  token!: string;
}
