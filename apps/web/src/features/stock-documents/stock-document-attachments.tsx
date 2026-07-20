'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button, Card, EmptyState, FormField, Input, StatusBadge } from '@/components/ui';
import type { StockDocumentAttachment } from '@/lib/types';
import { stockDocumentsService } from './stock-documents.service';
import { canPreviewImage, formatFileSize } from './stock-document-attachments-model';

const ACCEPTED_FILES = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf';

export function StockDocumentAttachments({
  attachments,
  files,
  disabled,
  onFilesChange,
  onRemoveAttachment,
}: {
  attachments: StockDocumentAttachment[];
  files: File[];
  disabled: boolean;
  onFilesChange: (files: File[]) => void;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
}) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: canPreviewImage(file.type) ? URL.createObjectURL(file) : null })),
    [files],
  );

  useEffect(() => () => previews.forEach((preview) => {
    if (preview.url) URL.revokeObjectURL(preview.url);
  }), [previews]);

  return (
    <Card title="Фото або PDF видаткової накладної">
      <div className="grid gap-3">
        <FormField
          label="Додати файл"
          hint="JPEG, PNG, WEBP, HEIC, HEIF або PDF. Максимальний розмір перевіряє сервер."
          required={!attachments.length && !files.length}
        >
          <Input
            accept={ACCEPTED_FILES}
            disabled={disabled}
            multiple
            type="file"
            onChange={(event) => onFilesChange([
              ...files,
              ...Array.from(event.target.files ?? []),
            ])}
          />
        </FormField>

        {!attachments.length && !files.length ? (
          <EmptyState message="До чернетки ще не додано накладну. Без вкладення провести видачу неможливо." />
        ) : null}

        {attachments.map((attachment) => (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-light)] p-3" key={attachment.id}>
            <div className="min-w-0">
              <a className="break-all font-semibold text-[var(--color-primary)] underline" href={stockDocumentsService.attachmentDownloadUrl(attachment.documentId, attachment.id)}>
                {attachment.originalFileName}
              </a>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {attachment.mimeType} · {formatFileSize(attachment.sizeBytes)}
              </p>
            </div>
            <Button disabled={disabled} variant="danger" type="button" onClick={() => void onRemoveAttachment(attachment.id)}>
              Видалити
            </Button>
          </div>
        ))}

        {previews.map(({ file, url }, index) => (
          <div className="grid min-w-0 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-light)] p-3 sm:grid-cols-[96px_1fr_auto] sm:items-center" key={`${file.name}-${file.size}-${index}`}>
            {url ? <Image unoptimized alt={`Попередній перегляд ${file.name}`} className="h-20 w-24 rounded-[var(--radius-sm)] object-cover" height={80} src={url} width={96} /> : <StatusBadge tone="info">PDF</StatusBadge>}
            <div className="min-w-0">
              <p className="break-all font-semibold">{file.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{file.type || 'Невідомий тип'} · {formatFileSize(file.size)}</p>
            </div>
            <Button disabled={disabled} variant="outline" type="button" onClick={() => onFilesChange(files.filter((_, current) => current !== index))}>
              Прибрати
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
