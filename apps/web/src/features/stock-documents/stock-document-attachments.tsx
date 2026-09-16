'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Button, Card, EmptyState, FormField, Input, StatusBadge } from '@/components/ui';
import { canPreviewImage, formatFileSize } from './stock-document-attachments-model';

const ACCEPTED_FILES = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf';

export function StockDocumentAttachments({
  files,
  disabled,
  onFilesChange,
}: {
  files: File[];
  disabled: boolean;
  onFilesChange: (files: File[]) => void;
}) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: canPreviewImage(file.type) ? URL.createObjectURL(file) : null })),
    [files],
  );

  useEffect(() => () => previews.forEach((preview) => {
    if (preview.url) URL.revokeObjectURL(preview.url);
  }), [previews]);

  return (
    <Card title="Підтверджуючий документ">
      <div className="grid gap-3">
        <FormField
          label="Додати файл"
          hint="Додайте фото видаткової накладної або іншого документа, що підтверджує видачу. JPEG, PNG, WEBP, HEIC, HEIF або PDF."
          required={!files.length}
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

        {!files.length ? (
          <EmptyState message="Додайте фото або PDF накладної. Без вкладення підтвердити видачу неможливо." />
        ) : null}

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
