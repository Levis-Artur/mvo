import { validate } from 'class-validator';
import { ResetTestDataDto } from './destructive-action.dto';

describe('ResetTestDataDto', () => {
  it('accepts only the explicit DELETE TEST DATA confirmation', async () => {
    const valid = Object.assign(new ResetTestDataDto(), {
      confirmation: 'DELETE TEST DATA',
    });
    const invalid = Object.assign(new ResetTestDataDto(), {
      confirmation: 'RESET_TEST_DATA',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
  });
});
