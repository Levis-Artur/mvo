'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui';
import type { IssueRealizationAttachment } from '@/lib/types';
import { AttachmentPreviewModal } from './attachment-preview-modal';
import {
  attachmentTypeLabel,
  canPreviewAttachment,
  formatFileSize,
} from './stock-document-attachments-model';
import { stockDocumentsService } from './stock-documents.service';

export function IssueRealizationAttachmentList({
  issueId,
  realizationId,
  attachments,
}: {
  issueId: string;
  realizationId: string;
  attachments: IssueRealizationAttachment[];
}) {
  const [preview, setPreview] = useState<IssueRealizationAttachment | null>(null);
  const previewLoader = useCallback(
    () =>
      stockDocumentsService.previewRealizationAttachment(
        issueId,
        realizationId,
        preview!.id,
      ),
    [issueId, preview, realizationId],
  );

  return (
    <>
      <ul className="stock-document-attachment-list">
        {attachments.map((attachment) => (
          <li key={attachment.id}>
            <div className="stock-document-attachment-list__metadata">
              <strong>{attachment.originalFileName}</strong>
              <span>
                {attachmentTypeLabel(attachment.mimeType)} ·{' '}
                {formatFileSize(attachment.sizeBytes)}
              </span>
            </div>
            <div className="stock-document-attachment-list__actions">
              {canPreviewAttachment(attachment.mimeType) ? (
                <Button
                  size="compact"
                  type="button"
                  variant="outline"
                  onClick={() => setPreview(attachment)}
                >
                  Переглянути
                </Button>
              ) : null}
              <a
                className="btn btn-outline"
                href={stockDocumentsService.realizationAttachmentDownloadUrl(
                  issueId,
                  realizationId,
                  attachment.id,
                )}
              >
                Завантажити
              </a>
            </div>
          </li>
        ))}
      </ul>
      {preview ? (
        <AttachmentPreviewModal
          attachment={preview}
          downloadUrl={stockDocumentsService.realizationAttachmentDownloadUrl(
            issueId,
            realizationId,
            preview.id,
          )}
          previewLoader={previewLoader}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
