'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import type { StockDocumentAttachment } from '@/lib/types';
import { AttachmentPreviewModal } from './attachment-preview-modal';
import {
  attachmentTypeLabel,
  canPreviewAttachment,
  formatFileSize,
} from './stock-document-attachments-model';
import { stockDocumentsService } from './stock-documents.service';

export function StockDocumentAttachmentList({
  attachments,
}: {
  attachments: StockDocumentAttachment[];
}) {
  const [preview, setPreview] = useState<StockDocumentAttachment | null>(null);

  return (
    <>
      <ul className="stock-document-attachment-list">
        {attachments.map((attachment) => {
          const previewable = canPreviewAttachment(attachment.mimeType);
          return (
            <li key={attachment.id}>
              <div className="stock-document-attachment-list__metadata">
                <strong>{attachment.originalFileName}</strong>
                <span>
                  {attachmentTypeLabel(attachment.mimeType)} ·{' '}
                  {formatFileSize(attachment.sizeBytes)}
                </span>
                {!previewable ? (
                  <span>Попередній перегляд для цього типу файла недоступний.</span>
                ) : null}
              </div>
              <div className="stock-document-attachment-list__actions">
                {previewable ? (
                  <Button
                    aria-label={`Переглянути ${attachment.originalFileName}`}
                    type="button"
                    onClick={() => setPreview(attachment)}
                  >
                    Переглянути
                  </Button>
                ) : null}
                <a
                  className="btn btn-outline"
                  href={stockDocumentsService.attachmentDownloadUrl(
                    attachment.documentId,
                    attachment.id,
                  )}
                >
                  Завантажити
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      {preview ? (
        <AttachmentPreviewModal
          attachment={preview}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
