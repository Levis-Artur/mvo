import { validateAttachmentFileSizes } from './attachment-upload';

const mb = 1024 * 1024;
describe('attachment size validation', () => {
  it.each([[19], [19, 19, 11]])('accepts sizes below both limits: %j MB', (...sizes) => {
    expect(() => validateAttachmentFileSizes(sizes.map((size) => ({ size: size * mb })), 20 * mb, 50 * mb)).not.toThrow();
  });
  it('rejects a file above the endpoint per-file limit', () => {
    expect(() => validateAttachmentFileSizes([{ size: 20 * mb + 1 }], 20 * mb, 50 * mb))
      .toThrow('Файл перевищує максимально допустимий розмір 20 МБ.');
  });
  it('rejects total above the endpoint total limit', () => {
    expect(() => validateAttachmentFileSizes([20, 20, 11].map((size) => ({ size: size * mb })), 20 * mb, 50 * mb))
      .toThrow('Сумарний розмір вкладень перевищує максимально допустимі 50 МБ.');
  });
});
