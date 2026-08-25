import { IsString, MaxLength, MinLength } from 'class-validator';

export class PreAuthTwoFactorRecoveryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  preAuthToken!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  recoveryCode!: string;
}
