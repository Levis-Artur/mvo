'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import type { StockDocumentAttachment } from '@/lib/types';
import { Button, ErrorState, LoadingState, Modal } from '@/components/ui';
import {
  canPreviewImage,
  clampPreviewZoom,
} from './stock-document-attachments-model';
import { stockDocumentsService } from './stock-documents.service';

export function AttachmentPreviewModal({
  attachment,
  onClose,
}: {
  attachment: StockDocumentAttachment;
  onClose: () => void;
}) {
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(100);
  const [fitToWindow, setFitToWindow] = useState(true);
  const [pdfFailed, setPdfFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    setLoading(true);
    setError('');
    setPdfFailed(false);
    void stockDocumentsService
      .previewAttachment(attachment.documentId, attachment.id)
      .then((preview) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(preview.blob);
        setObjectUrl(createdUrl);
      })
      .catch((reason: unknown) => {
        if (active) setError(previewErrorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment.documentId, attachment.id]);

  const image = canPreviewImage(attachment.mimeType);
  const pdf = attachment.mimeType === 'application/pdf';
  const downloadUrl = stockDocumentsService.attachmentDownloadUrl(
    attachment.documentId,
    attachment.id,
  );

  function changeZoom(nextZoom: number) {
    setFitToWindow(false);
    setZoom(clampPreviewZoom(nextZoom));
  }

  return (
    <Modal
      closeOnEscape
      footer={
        <>
          <a className="btn btn-outline" href={downloadUrl}>
            Завантажити
          </a>
          <Button type="button" variant="outline" onClick={onClose}>
            Закрити
          </Button>
        </>
      }
      onClose={onClose}
      size="fullscreen"
      title={`Перегляд документа — ${attachment.originalFileName}`}
    >
      <div className="attachment-preview">
        {image && objectUrl && !error ? (
          <div className="attachment-preview__toolbar" role="toolbar" aria-label="Масштаб документа">
            <Button
              aria-label="Зменшити масштаб"
              disabled={zoom <= 25 && !fitToWindow}
              size="compact"
              type="button"
              variant="outline"
              onClick={() => changeZoom((fitToWindow ? 100 : zoom) - 25)}
            >
              −
            </Button>
            <output aria-label="Поточний масштаб">
              {fitToWindow ? 'За розміром вікна' : `${zoom}%`}
            </output>
            <Button
              aria-label="Збільшити масштаб"
              disabled={zoom >= 400 && !fitToWindow}
              size="compact"
              type="button"
              variant="outline"
              onClick={() => changeZoom((fitToWindow ? 100 : zoom) + 25)}
            >
              +
            </Button>
            <Button
              aria-label="Показати за розміром вікна"
              size="compact"
              type="button"
              variant="outline"
              onClick={() => {
                setFitToWindow(true);
                setZoom(100);
              }}
            >
              За розміром вікна
            </Button>
          </div>
        ) : null}

        {loading ? (
          <LoadingState label="Завантаження документа…" />
        ) : null}
        {error ? <ErrorState message={error} /> : null}

        {!loading && !error && image && objectUrl ? (
          <div
            className="attachment-preview__canvas"
            data-fit={fitToWindow ? 'true' : 'false'}
          >
            {/* Blob URL is authenticated, temporary and intentionally bypasses image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Підтверджуючий документ ${attachment.originalFileName}`}
              className="attachment-preview__image"
              src={objectUrl}
              style={
                fitToWindow
                  ? undefined
                  : { maxHeight: 'none', maxWidth: 'none', width: `${zoom}%` }
              }
            />
          </div>
        ) : null}

        {!loading && !error && pdf && objectUrl ? (
          pdfFailed ? (
            <div className="attachment-preview__fallback">
              <ErrorState message="Не вдалося відобразити PDF у браузері." />
              <a className="btn btn-outline" href={downloadUrl}>
                Завантажити
              </a>
            </div>
          ) : (
            <object
              aria-label={`PDF ${attachment.originalFileName}`}
              className="attachment-preview__pdf"
              data={objectUrl}
              type="application/pdf"
              onError={() => setPdfFailed(true)}
            >
              <div className="attachment-preview__fallback">
                <p>Не вдалося відобразити PDF у браузері.</p>
                <a className="btn btn-outline" href={downloadUrl}>
                  Завантажити
                </a>
              </div>
            </object>
          )
        ) : null}
      </div>
    </Modal>
  );
}

export function previewErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.status === 403) {
      return 'У вас немає доступу до цього документа.';
    }
    if (reason.status === 404) return 'Документ не знайдено.';
  }
  return 'Не вдалося відкрити документ.';
}
