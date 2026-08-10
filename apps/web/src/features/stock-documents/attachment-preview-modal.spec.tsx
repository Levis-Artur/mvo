/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/ui';
import { ApiError } from '@/lib/api-client';
import type { StockDocumentAttachment } from '@/lib/types';
import { StockDocumentAttachmentList } from './stock-document-attachment-list';
import { stockDocumentsService } from './stock-documents.service';

jest.mock('./stock-documents.service', () => ({
  stockDocumentsService: {
    previewAttachment: jest.fn(),
    attachmentDownloadUrl: jest.fn(
      (documentId: string, attachmentId: string) =>
        `/api/stock-documents/${documentId}/attachments/${attachmentId}/download`,
    ),
  },
}));

const previewAttachment = stockDocumentsService.previewAttachment as jest.Mock;
const createObjectURL = jest.fn(() => 'blob:protected-preview');
const revokeObjectURL = jest.fn();

function attachment(
  mimeType = 'image/jpeg',
  originalFileName = 'накладна.jpg',
): StockDocumentAttachment {
  return {
    id: 'attachment-id',
    documentId: 'issue-id',
    originalFileName,
    mimeType,
    sizeBytes: 2048,
    sha256: 'hash',
    uploadedByUserId: 'user-id',
    createdAt: '2026-08-10T00:00:00.000Z',
  };
}

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURL,
  });
});

beforeEach(() => {
  previewAttachment.mockReset();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(cleanup);

describe('ISSUE attachment inline preview', () => {
  it('завантажує image авторизованим API-клієнтом, керує zoom і очищає object URL', async () => {
    let resolvePreview: ((value: { blob: Blob; filename: string; mimeType: string }) => void) | undefined;
    previewAttachment.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<StockDocumentAttachmentList attachments={[attachment()]} />);

    expect(screen.getByText('накладна.jpg')).toBeTruthy();
    expect(screen.getByText(/JPEG/)).toBeTruthy();
    const opener = screen.getByRole('button', { name: 'Переглянути накладна.jpg' });
    await user.click(opener);

    expect(previewAttachment).toHaveBeenCalledWith('issue-id', 'attachment-id');
    expect(screen.getByText('Завантаження документа…')).toBeTruthy();
    resolvePreview?.({
      blob: new Blob(['image'], { type: 'image/jpeg' }),
      filename: 'накладна.jpg',
      mimeType: 'image/jpeg',
    });

    const image = await screen.findByRole('img', {
      name: 'Підтверджуючий документ накладна.jpg',
    });
    expect(image.getAttribute('src')).toBe('blob:protected-preview');
    await user.click(screen.getByRole('button', { name: 'Збільшити масштаб' }));
    expect((image as HTMLImageElement).style.width).toBe('125%');

    await user.click(screen.getAllByRole('button', { name: 'Закрити' })[0]);
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:protected-preview'));
    expect(document.activeElement).toBe(opener);
  });

  it('відображає PDF через blob URL та залишає окреме завантаження', async () => {
    previewAttachment.mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'накладна.pdf',
      mimeType: 'application/pdf',
    });
    const { container } = render(
      <StockDocumentAttachmentList
        attachments={[attachment('application/pdf', 'накладна.pdf')]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Переглянути накладна.pdf' }));
    await waitFor(() => expect(container.querySelector('object[type="application/pdf"]')).toBeTruthy());
    expect(
      screen.getAllByRole('link', { name: 'Завантажити' })[0].getAttribute('href'),
    ).toBe('/api/stock-documents/issue-id/attachments/attachment-id/download');
  });

  it('для HEIC показує download-only fallback без preview-запиту', () => {
    render(
      <StockDocumentAttachmentList
        attachments={[attachment('image/heic', 'накладна.heic')]}
      />,
    );

    expect(
      screen.getByText('Попередній перегляд для цього типу файла недоступний.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /\u041fереглянути/ })).toBeNull();
    expect(previewAttachment).not.toHaveBeenCalled();
  });

  it('показує безпечне повідомлення про відсутність доступу', async () => {
    previewAttachment.mockRejectedValue(new ApiError('технічна помилка', 403));
    render(<StockDocumentAttachmentList attachments={[attachment()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Переглянути накладна.jpg' }));
    expect(
      await screen.findByText('У вас немає доступу до цього документа.'),
    ).toBeTruthy();
    expect(screen.queryByText('технічна помилка')).toBeNull();
  });

  it('закриває Escape лише верхній preview і повертає focus до кнопки ISSUE', async () => {
    previewAttachment.mockResolvedValue({
      blob: new Blob(['image'], { type: 'image/jpeg' }),
      filename: 'накладна.jpg',
      mimeType: 'image/jpeg',
    });
    const closeIssue = jest.fn();
    const user = userEvent.setup();
    render(
      <Modal title="Видача № 12" onClose={closeIssue}>
        <StockDocumentAttachmentList attachments={[attachment()]} />
      </Modal>,
    );
    const opener = screen.getByRole('button', {
      name: 'Переглянути накладна.jpg',
    });

    await user.click(opener);
    await screen.findByRole('img');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('heading', { name: /\u041fерегляд документа/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Видача № 12' })).toBeTruthy();
    expect(closeIssue).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });
});
