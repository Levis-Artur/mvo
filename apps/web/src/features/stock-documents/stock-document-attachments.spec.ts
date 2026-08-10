import {
  attachmentTypeLabel,
  canPreviewAttachment,
  canPreviewImage,
  clampPreviewZoom,
  formatFileSize,
} from './stock-document-attachments-model';

describe('stock document attachment presentation', () => {
  it('показує preview лише для форматів, які браузер відтворює стабільно', () => {
    expect(canPreviewImage('image/jpeg')).toBe(true);
    expect(canPreviewImage('image/png')).toBe(true);
    expect(canPreviewImage('image/webp')).toBe(true);
    expect(canPreviewImage('image/heic')).toBe(false);
    expect(canPreviewImage('application/pdf')).toBe(false);
    expect(canPreviewAttachment('application/pdf')).toBe(true);
    expect(canPreviewAttachment('image/heic')).toBe(false);
  });

  it('показує зрозумілий розмір вкладення', () => {
    expect(formatFileSize(1024)).toBe('1.0 КБ');
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10.0 МБ');
  });

  it('показує тип файла й обмежує zoom безпечним діапазоном', () => {
    expect(attachmentTypeLabel('application/pdf')).toBe('PDF');
    expect(attachmentTypeLabel('image/heif')).toBe('HEIF');
    expect(clampPreviewZoom(10)).toBe(25);
    expect(clampPreviewZoom(450)).toBe(400);
  });
});
