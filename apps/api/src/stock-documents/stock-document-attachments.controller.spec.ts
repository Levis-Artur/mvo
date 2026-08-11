import { Readable } from 'node:stream';
import { StockDocumentsController } from './stock-documents.controller';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'owner',
  role: 'OWNER',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};

describe('StockDocumentsController attachment preview', () => {
  it.each([
    ['image/jpeg', 'invoice.jpg'],
    ['application/pdf', 'накладна.pdf'],
  ])('streams %s inline with private security headers', async (mimeType, filename) => {
    const attachments = {
      preview: jest.fn().mockResolvedValue({
        metadata: {
          originalFileName: filename,
          mimeType,
          sizeBytes: 12,
        },
        stream: Readable.from(Buffer.from('preview')),
      }),
    };
    const controller = new StockDocumentsController(
      {} as never,
      attachments as never,
      {} as never,
      {} as never,
    );
    const response = { setHeader: jest.fn() };

    const streamed = await controller.previewAttachment(
      'document-id',
      'attachment-id',
      actor as never,
      {
        requestId: 'request-id',
        headers: {},
        ip: '127.0.0.1',
      } as never,
      response as never,
    );

    expect(attachments.preview).toHaveBeenCalledWith(
      'document-id',
      'attachment-id',
      actor,
      expect.objectContaining({ requestId: 'request-id' }),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store',
    );
    expect(streamed.getHeaders()).toEqual(
      expect.objectContaining({
        type: mimeType,
        length: 12,
        disposition: expect.stringMatching(/^inline; filename\*=UTF-8''/),
      }),
    );
  });
});
