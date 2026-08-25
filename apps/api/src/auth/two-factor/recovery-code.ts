import { createHash } from 'node:crypto';

export function hashRecoveryCode(code: string): string {
  if (!code) throw new Error('Recovery code must not be empty');
  return createHash('sha256').update(code, 'utf8').digest('hex');
}
