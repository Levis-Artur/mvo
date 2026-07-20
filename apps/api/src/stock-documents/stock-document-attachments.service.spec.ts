import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockDocumentStatus, StockDocumentType, UserRole } from '@prisma/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StockDocumentAttachmentStorageService } from './stock-document-attachment-storage.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';

const owner = {
  id: '11111111-1111-4111-8111-111111111111',
  username: 'owner',
  role: UserRole.OWNER,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: null,
};
const sourceId = '22222222-2222-4222-8222-222222222222';

function uploadedFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7\ninvoice');
  return {
    fieldname: 'file',
    originalname: 'накладна.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: undefined as never,
    ...overrides,
  };
}

describe('StockDocumentAttachmentStorageService', () => {
  let directory: string;
  let previousDirectory: string | undefined;
  let previousLimit: string | undefined;

  beforeEach(async () => {
    previousDirectory = process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR;
    previousLimit = process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES;
    directory = await mkdtemp(join(tmpdir(), 'mvo-attachment-'));
    process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR = directory;
    process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES = '1024';
  });

  afterEach(async () => {
    if (previousDirectory === undefined) {
      delete process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR;
    } else {
      process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR = previousDirectory;
    }
    if (previousLimit === undefined) {
      delete process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES;
    } else {
      process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES = previousLimit;
    }
    await rm(directory, { recursive: true, force: true });
  });

  it('stores an allowed file under UUID and calculates SHA-256', async () => {
    const service = new StockDocumentAttachmentStorageService();
    const result = await service.store(uploadedFile());

    expect(result.originalFileName).toBe('накладна.pdf');
    expect(result.storedFileName).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/,
    );
    expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(
      service.assertStoredFilesExist([result.storagePath]),
    ).resolves.toBeUndefined();
  });

  it('rejects forbidden MIME, excessive size and path traversal', async () => {
    const service = new StockDocumentAttachmentStorageService();
    await expect(
      service.store(uploadedFile({ mimetype: 'text/plain' })),
    ).rejects.toBeInstanceOf(BadRequestException);

    const largeBuffer = Buffer.concat([
      Buffer.from('%PDF-'),
      Buffer.alloc(1020),
    ]);
    await expect(
      service.store(
        uploadedFile({ buffer: largeBuffer, size: largeBuffer.length }),
      ),
    ).rejects.toThrow('перевищує дозволені');

    await expect(
      service.store(uploadedFile({ originalname: '../invoice.pdf' })),
    ).rejects.toThrow('містить шлях');
  });

  it('rejects a file whose magic bytes do not match MIME', async () => {
    const service = new StockDocumentAttachmentStorageService();
    const buffer = Buffer.from('not a pdf');
    await expect(
      service.store(uploadedFile({ buffer, size: buffer.length })),
    ).rejects.toThrow('Вміст файлу не відповідає');
  });
});

describe('StockDocumentAttachmentsService authorization', () => {
  function createService(
    status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  ) {
    const document = {
      id: 'document-id',
      type: StockDocumentType.ISSUE,
      status,
      createdByUserId: owner.id,
      sourceResponsiblePersonId: sourceId,
      destinationResponsiblePersonId: null,
      lines: [{ accountingOwnerResponsiblePersonId: sourceId }],
    };
    const attachment = {
      id: 'attachment-id',
      documentId: document.id,
      originalFileName: 'invoice.pdf',
      storedFileName: 'stored.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      sha256: 'hash',
      storagePath: 'stored.pdf',
      uploadedByUserId: owner.id,
      createdAt: new Date(),
      document,
    };
    const tx = {
      stockDocument: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      stockDocumentAttachment: {
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityEvent: { create: jest.fn() },
    };
    const prisma = {
      stockDocument: { findUnique: jest.fn().mockResolvedValue(document) },
      stockDocumentAttachment: {
        findFirst: jest.fn().mockResolvedValue(attachment),
        findMany: jest.fn(),
      },
      securityEvent: { create: jest.fn() },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const storage = {
      assertStoredFilesExist: jest.fn(),
      createDownloadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
      stageForDeletion: jest.fn().mockResolvedValue({
        storagePath: 'stored.pdf',
        stagedStoragePath: '.deleting-file',
      }),
      restoreStaged: jest.fn(),
      finalizeDeletion: jest.fn(),
      store: jest.fn(),
      removeAfterMetadataFailure: jest.fn(),
      listStoredFileNames: jest.fn(),
    };
    return {
      service: new StockDocumentAttachmentsService(
        prisma as never,
        storage as never,
      ),
      prisma,
      storage,
    };
  }

  it('allows linked MVO download and hides internal storage metadata', async () => {
    const { service, prisma } = createService();
    const result = await service.download(
      'document-id',
      'attachment-id',
      {
        ...owner,
        role: UserRole.MVO,
        responsiblePersonId: sourceId,
      },
      { requestId: 'request-1' },
    );

    expect(result.metadata.originalFileName).toBe('invoice.pdf');
    expect(result.metadata).not.toHaveProperty('storagePath');
    expect(result.metadata).not.toHaveProperty('storedFileName');
    expect(prisma.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestId: 'request-1' }),
      }),
    );
  });

  it('hides download from an unrelated MVO', async () => {
    const { service, storage } = createService();
    await expect(
      service.download('document-id', 'attachment-id', {
        ...owner,
        id: '44444444-4444-4444-8444-444444444444',
        role: UserRole.MVO,
        responsiblePersonId: '33333333-3333-4333-8333-333333333333',
      }, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.createDownloadStream).not.toHaveBeenCalled();
  });

  it('does not delete an attachment after the ISSUE is POSTED', async () => {
    const { service, storage } = createService(StockDocumentStatus.POSTED);
    await expect(
      service.remove('document-id', 'attachment-id', owner, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
  });
});
