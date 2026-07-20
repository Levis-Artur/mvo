import { canPreviewImage, formatFileSize } from './stock-document-attachments-model';

describe('stock document attachment presentation', () => {
  it('показує preview лише для форматів, які браузер відтворює стабільно', () => {
    expect(canPreviewImage('image/jpeg')).toBe(true);
    expect(canPreviewImage('image/png')).toBe(true);
    expect(canPreviewImage('image/webp')).toBe(true);
    expect(canPreviewImage('image/heic')).toBe(false);
    expect(canPreviewImage('application/pdf')).toBe(false);
  });

  it('показує зрозумілий розмір вкладення', () => {
    expect(formatFileSize(1024)).toBe('1.0 КБ');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 МБ');
  });
});
