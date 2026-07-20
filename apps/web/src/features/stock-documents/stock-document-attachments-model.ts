export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} Б`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} КБ`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function canPreviewImage(mimeType: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType);
}
