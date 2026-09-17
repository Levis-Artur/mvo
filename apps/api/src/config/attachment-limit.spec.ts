import { attachmentFileSizeLimitBytes, attachmentUploadLimits } from './env';

describe('document attachment limit', () => {
  const previous = process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
  const previousTotal = process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB;
  beforeEach(() => { delete process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB; });
  afterEach(() => {
    if (previous === undefined) delete process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
    else process.env.MAX_ATTACHMENT_FILE_SIZE_MB = previous;
    if (previousTotal === undefined) delete process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB;
    else process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB = previousTotal;
  });

  it.each([undefined, '', '   '])('defaults to 20/50 MB without a configured value (%s)', (value) => {
    if (value === undefined) delete process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
    else process.env.MAX_ATTACHMENT_FILE_SIZE_MB = value;
    if (value !== undefined) process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB = value;
    expect(attachmentUploadLimits()).toEqual({ maxFileSizeBytes: 20 * 1024 * 1024, maxTotalSizeBytes: 50 * 1024 * 1024 });
  });

  it('uses the configured MB limit', () => {
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB = '12';
    expect(attachmentFileSizeLimitBytes()).toBe(12 * 1024 * 1024);
  });

  it.each(['0', 'invalid', '51', '60'])('rejects invalid per-file limits (%s)', (value) => {
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB = value;
    expect(attachmentFileSizeLimitBytes).toThrow('MAX_ATTACHMENT_FILE_SIZE_MB');
  });

  it.each(['0', 'invalid', '19', '60'])('rejects invalid total limits (%s)', (value) => {
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB = '20';
    process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB = value;
    expect(attachmentUploadLimits).toThrow();
  });
});
