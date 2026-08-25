import { authenticator } from 'otplib';
import { generateOtpAuthUrl, generateSecret, verifyToken } from './totp';

describe('TOTP helper', () => {
  it('accepts a valid six-digit token', async () => {
    const secret = generateSecret();
    const token = authenticator.clone({
      digits: 6,
      step: 30,
      window: 1,
    }).generate(secret);

    await expect(verifyToken(secret, token)).resolves.toBe(true);
  });

  it('rejects an invalid token', async () => {
    await expect(verifyToken(generateSecret(), 'not-a-token')).resolves.toBe(
      false,
    );
  });

  it('builds an MVO Inventory otpauth URL', () => {
    const url = new URL(generateOtpAuthUrl(generateSecret(), 'owner'));

    expect(url.protocol).toBe('otpauth:');
    expect(url.searchParams.get('issuer')).toBe('MVO Inventory');
    expect(url.searchParams.get('digits')).toBe('6');
    expect(url.searchParams.get('period')).toBe('30');
  });
});
