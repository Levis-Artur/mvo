import { BadRequestException } from '@nestjs/common';
import { attachmentUploadLimits, attachmentFileSizeErrorMessage } from '../config/env';

export function validateAttachmentUploadSizes(files: Array<{ size: number }>): void {
  const limits = attachmentUploadLimits();
  if (files.some((file) => !Number.isSafeInteger(file.size) || file.size < 0)) {
    throw new BadRequestException('Некоректний розмір вкладення.');
  }
  if (files.some((file) => file.size > limits.maxFileSizeBytes)) {
    throw new BadRequestException(attachmentFileSizeErrorMessage());
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > limits.maxTotalSizeBytes) {
    const megabytes = limits.maxTotalSizeBytes / (1024 * 1024);
    throw new BadRequestException(`Сумарний розмір вкладень перевищує максимально допустимі ${megabytes.toLocaleString('uk-UA')} МБ.`);
  }
}
