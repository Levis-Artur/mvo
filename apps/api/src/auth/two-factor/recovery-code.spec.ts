import { hashRecoveryCode } from './recovery-code';

describe('recovery code hashing', () => {
  it('is deterministic', () => {
    expect(hashRecoveryCode('ABCD-EFGH')).toBe(
      hashRecoveryCode('ABCD-EFGH'),
    );
    expect(hashRecoveryCode('ABCD-EFGH')).not.toBe(
      hashRecoveryCode('WXYZ-1234'),
    );
  });
});
