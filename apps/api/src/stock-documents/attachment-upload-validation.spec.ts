import { BadRequestException } from '@nestjs/common';
import { validateAttachmentUploadSizes } from './attachment-upload-validation';

describe('attachment upload sizes', () => {
  const previousFile = process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
  const previousTotal = process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB;
  beforeEach(() => {
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB = '20';
    process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB = '50';
  });
  afterEach(() => {
    if (previousFile === undefined) delete process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
    else process.env.MAX_ATTACHMENT_FILE_SIZE_MB = previousFile;
    if (previousTotal === undefined) delete process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB;
    else process.env.MAX_ATTACHMENT_TOTAL_SIZE_MB = previousTotal;
  });
  const mb = 1024 * 1024;
  it.each([[19], [19, 19, 11]])('accepts sizes below both limits: %j MB', (...sizes) => {
    expect(() => validateAttachmentUploadSizes(sizes.map((size) => ({ size: size * mb })))).not.toThrow();
  });
  it('rejects a file above 20 MB', () => {
    expect(() => validateAttachmentUploadSizes([{ size: 20 * mb + 1 }])).toThrow(BadRequestException);
  });
  it('rejects total above 50 MB even when every file fits', () => {
    expect(() => validateAttachmentUploadSizes([20, 20, 11].map((size) => ({ size: size * mb }))))
      .toThrow('Сумарний розмір вкладень перевищує максимально допустимі 50 МБ.');
  });
});
