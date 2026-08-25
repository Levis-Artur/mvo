import { authenticator } from 'otplib';

const ISSUER = 'MVO Inventory';
const DIGITS = 6 as const;
const PERIOD_SECONDS = 30;

function createTotpAuthenticator() {
  return authenticator.clone({
    digits: DIGITS,
    step: PERIOD_SECONDS,
    window: 1,
  });
}

export function generateSecret(): string {
  return createTotpAuthenticator().generateSecret(20);
}

export function generateOtpAuthUrl(secret: string, username: string): string {
  if (!secret || !username.trim()) {
    throw new Error('TOTP secret and username are required');
  }
  return createTotpAuthenticator().keyuri(username.trim(), ISSUER, secret);
}

export async function verifyToken(
  secret: string,
  token: string,
): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  return createTotpAuthenticator().verify({ secret, token });
}
