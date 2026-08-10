export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} Б`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} КБ`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function canPreviewImage(mimeType: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
}

export function canPreviewAttachment(mimeType: string) {
  return canPreviewImage(mimeType) || mimeType === 'application/pdf';
}

export function attachmentTypeLabel(mimeType: string) {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg') return 'JPEG';
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/webp') return 'WebP';
  if (mimeType === 'image/heic') return 'HEIC';
  if (mimeType === 'image/heif') return 'HEIF';
  return mimeType;
}

export function clampPreviewZoom(value: number) {
  return Math.min(400, Math.max(25, value));
}
