import { randomBytes } from 'node:crypto';
import { decryptTotpSecret, encryptTotpSecret } from './totp-secret-crypto';

describe('TOTP secret encryption', () => {
  const key = randomBytes(32).toString('base64');

  it('decrypts an encrypted secret to its original value', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    expect(decryptTotpSecret(encryptTotpSecret(secret, key), key)).toBe(secret);
  });

  it('uses a unique IV for every encryption', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    expect(encryptTotpSecret(secret, key)).not.toBe(
      encryptTotpSecret(secret, key),
    );
  });

  it('rejects a wrong key and malformed payload', () => {
    const payload = encryptTotpSecret('JBSWY3DPEHPK3PXP', key);
    const wrongKey = randomBytes(32).toString('base64');

    expect(() => decryptTotpSecret(payload, wrongKey)).toThrow(
      'Unable to decrypt TOTP secret',
    );
    expect(() => decryptTotpSecret('plaintext-secret', key)).toThrow();
    expect(() => encryptTotpSecret('secret', 'invalid-key')).toThrow();
  });

  it('does not fall back to plaintext when the environment key is missing', () => {
    const previous = process.env.TOTP_ENCRYPTION_KEY;
    delete process.env.TOTP_ENCRYPTION_KEY;
    try {
      expect(() => encryptTotpSecret('secret')).toThrow(
        'Missing required environment variable: TOTP_ENCRYPTION_KEY',
      );
    } finally {
      if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY;
      else process.env.TOTP_ENCRYPTION_KEY = previous;
    }
  });
});
