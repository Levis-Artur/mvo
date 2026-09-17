export function validateAttachmentFileSizes(files: Array<{ size: number }>, maxFileSizeBytes: number, maxTotalSizeBytes: number): void {
  if (!Number.isInteger(maxFileSizeBytes) || maxFileSizeBytes < 1024
    || !Number.isInteger(maxTotalSizeBytes) || maxTotalSizeBytes < maxFileSizeBytes) {
    throw new Error('Не вдалося отримати допустимий розмір вкладень. Спробуйте ще раз.');
  }
  if (files.some((file) => file.size > maxFileSizeBytes)) {
    const megabytes = maxFileSizeBytes / (1024 * 1024);
    throw new Error(`Файл перевищує максимально допустимий розмір ${megabytes.toLocaleString('uk-UA')} МБ.`);
  }
  if (files.reduce((sum, file) => sum + file.size, 0) > maxTotalSizeBytes) {
    const megabytes = maxTotalSizeBytes / (1024 * 1024);
    throw new Error(`Сумарний розмір вкладень перевищує максимально допустимі ${megabytes.toLocaleString('uk-UA')} МБ.`);
  }
}
