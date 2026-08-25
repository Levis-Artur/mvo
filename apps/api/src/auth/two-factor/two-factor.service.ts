import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashRecoveryCode } from './recovery-code';
import { decryptTotpSecret, encryptTotpSecret } from './totp-secret-crypto';
import { generateOtpAuthUrl, generateSecret, verifyToken } from './totp';

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_LENGTH = 16;

type EnrollmentUser = {
  id: string;
  username: string;
  twoFactorEnabled: boolean;
  twoFactorSecretEncrypted: string | null;
};

export class InvalidTwoFactorTokenException extends UnauthorizedException {
  constructor() {
    super('Невірний код автентифікатора.');
  }
}

@Injectable()
export class TwoFactorService {
  constructor(private readonly prisma: PrismaService) {}

  async beginEnrollment(userId: string): Promise<{
    otpauthUrl: string;
    manualKey: string;
  }> {
    const user = await this.findActiveUser(userId);
    this.assertNotEnabled(user);

    const secret = generateSecret();
    const encryptedSecret = encryptTotpSecret(secret);
    const otpauthUrl = generateOtpAuthUrl(secret, user.username);
    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        isActive: true,
        twoFactorEnabled: false,
      },
      data: {
        twoFactorSecretEncrypted: encryptedSecret,
        twoFactorEnabled: false,
        twoFactorConfirmedAt: null,
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Не вдалося розпочати налаштування 2FA.');
    }

    return { otpauthUrl, manualKey: secret };
  }

  async confirmEnrollment(
    userId: string,
    token: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.findActiveUser(userId);
    this.assertNotEnabled(user);
    if (!user.twoFactorSecretEncrypted) {
      throw new BadRequestException('Налаштування 2FA не було розпочато.');
    }

    const secret = decryptTotpSecret(user.twoFactorSecretEncrypted);
    if (!(await verifyToken(secret, token))) {
      throw new InvalidTwoFactorTokenException();
    }

    const recoveryCodes = this.generateRecoveryCodes();
    const confirmedAt = new Date();

    const confirmWith = async (client: Prisma.TransactionClient) => {
      const updated = await client.user.updateMany({
        where: {
          id: user.id,
          isActive: true,
          twoFactorEnabled: false,
          twoFactorSecretEncrypted: user.twoFactorSecretEncrypted,
        },
        data: {
          twoFactorEnabled: true,
          twoFactorConfirmedAt: confirmedAt,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Налаштування 2FA вже було підтверджено.');
      }

      await client.twoFactorRecoveryCode.deleteMany({
        where: { userId: user.id },
      });
      await client.twoFactorRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          userId: user.id,
          codeHash: hashRecoveryCode(code),
        })),
      });
    };

    if (transaction) await confirmWith(transaction);
    else await this.prisma.$transaction(confirmWith);

    return { recoveryCodes };
  }

  private async findActiveUser(userId: string): Promise<EnrollmentUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        username: true,
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: true,
      },
    });

    if (!user) throw new NotFoundException('Активного користувача не знайдено.');
    return user;
  }

  private assertNotEnabled(user: EnrollmentUser): void {
    if (user.twoFactorEnabled) {
      throw new ConflictException('Двофакторну автентифікацію вже увімкнено.');
    }
  }

  private generateRecoveryCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < RECOVERY_CODE_COUNT) {
      codes.add(this.generateRecoveryCode());
    }
    return [...codes];
  }

  private generateRecoveryCode(): string {
    const bytes = randomBytes(RECOVERY_CODE_LENGTH);
    const characters = Array.from(
      bytes,
      (byte) => RECOVERY_CODE_ALPHABET[byte & 31],
    ).join('');
    return characters.match(/.{1,4}/g)?.join('-') ?? characters;
  }
}
