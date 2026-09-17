import {
  BadRequestException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { StockDocumentStatus, StockDocumentType, UserRole } from '@prisma/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StockDocumentAttachmentStorageService } from './stock-document-attachment-storage.service';
import { StockDocumentAttachmentsService } from './stock-document-attachments.service';
import { AccessControlService } from '../auth/access-control.service';

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
    previousLimit = process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
    directory = await mkdtemp(join(tmpdir(), 'mvo-attachment-'));
    process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR = directory;
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB = String(1 / 1024);
  });

  afterEach(async () => {
    if (previousDirectory === undefined) {
      delete process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR;
    } else {
      process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR = previousDirectory;
    }
    if (previousLimit === undefined) {
      delete process.env.MAX_ATTACHMENT_FILE_SIZE_MB;
    } else {
      process.env.MAX_ATTACHMENT_FILE_SIZE_MB = previousLimit;
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
    ).rejects.toThrow('Файл перевищує максимально допустимий розмір');

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

  it.each([
    ['application/pdf', 'document.pdf', Buffer.from('%PDF-1.7\n')],
    ['image/jpeg', 'photo.jpg', Buffer.from([0xff, 0xd8, 0xff])],
  ])('accepts %s below the configured limit', async (mimetype, originalname, header) => {
    const buffer = Buffer.concat([header, Buffer.alloc(1023 - header.length)]);
    const service = new StockDocumentAttachmentStorageService();
    await expect(service.store(uploadedFile({ mimetype, originalname, buffer, size: buffer.length })))
      .resolves.toEqual(expect.objectContaining({ mimeType: mimetype }));
  });
});

describe('StockDocumentAttachmentsService authorization', () => {
  function createService(
    status: StockDocumentStatus = StockDocumentStatus.DRAFT,
  ) {
    const document = {
      id: 'document-id',
      type: StockDocumentType.ISSUE as StockDocumentType,
      status,
      createdByUserId: owner.id,
      sourceResponsiblePersonId: sourceId,
      destinationResponsiblePersonId: null,
      sourceTransferId: 'transfer-id',
      sourceTransfer: { sourceResponsiblePersonId: sourceId },
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
      stockDocument: { findUnique: jest.fn().mockResolvedValue(document), findFirst: jest.fn().mockResolvedValue({ id: 'document-id' }) },
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
        new AccessControlService(prisma as never),
      ),
      prisma,
      storage,
      document,
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

  it.each(['preview', 'download'] as const)('allows scoped manager %s and rejects foreign files before storage', async (action) => {
    const { service, prisma, storage } = createService(StockDocumentStatus.POSTED);
    const manager = {
      ...owner, role: UserRole.ORG_MANAGER,
      accessScopes: [{ managementId: 'manager-management', serviceCode: null }],
    };
    await expect(service[action]('document-id', 'attachment-id', manager, {})).resolves.toBeDefined();
    expect(prisma.stockDocument.findFirst).toHaveBeenCalledWith({
      where: { AND: [{ id: 'document-id' }, { OR: [
        { sourceResponsiblePerson: { OR: [{ managementId: 'manager-management' }] } },
        { destinationResponsiblePerson: { OR: [{ managementId: 'manager-management' }] } },
      ] }] }, select: { id: true },
    });
    storage.assertStoredFilesExist.mockClear();
    storage.createDownloadStream.mockClear();
    prisma.stockDocument.findFirst.mockResolvedValueOnce(null as never);
    await expect(service[action]('document-id', 'attachment-id', manager, {})).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.assertStoredFilesExist).not.toHaveBeenCalled();
    expect(storage.createDownloadStream).not.toHaveBeenCalled();
  });

  it('allows manager preview of transfer attachments through the same private flow', async () => {
    const { service, document } = createService(StockDocumentStatus.POSTED);
    document.type = StockDocumentType.MVO_TRANSFER;
    await expect(service.preview('document-id', 'attachment-id', {
      ...owner, role: UserRole.ORG_MANAGER,
      accessScopes: [{ managementId: 'manager-management', serviceCode: null }],
    }, {})).resolves.toBeDefined();
  });

  it.each([UserRole.OWNER, UserRole.ACCOUNTANT])(
    'allows %s to preview an ISSUE attachment through global read permission',
    async (role) => {
      const { service } = createService(StockDocumentStatus.POSTED);
      const result = await service.preview(
        'document-id',
        'attachment-id',
        { ...owner, role },
        { requestId: 'preview-request' },
      );

      expect(result.metadata).toEqual(
        expect.objectContaining({
          originalFileName: 'invoice.pdf',
          mimeType: 'application/pdf',
        }),
      );
      expect(result.metadata).not.toHaveProperty('storagePath');
    },
  );

  it('allows only the source MVO to preview a child ISSUE attachment', async () => {
    const { service } = createService(StockDocumentStatus.POSTED);
    await expect(
      service.preview(
        'document-id',
        'attachment-id',
        {
          ...owner,
          role: UserRole.MVO,
          responsiblePersonId: sourceId,
        },
        {},
      ),
    ).resolves.toBeDefined();
  });

  it('allows the source MVO to preview a legacy standalone ISSUE attachment', async () => {
    const { service, document, storage } = createService(
      StockDocumentStatus.POSTED,
    );
    const unlinkedDocument = document as unknown as {
      sourceTransferId: string | null;
      sourceTransfer: { sourceResponsiblePersonId: string } | null;
    };
    unlinkedDocument.sourceTransferId = null;
    unlinkedDocument.sourceTransfer = null;

    await expect(
      service.preview(
        'document-id',
        'attachment-id',
        {
          ...owner,
          role: UserRole.MVO,
          responsiblePersonId: sourceId,
        },
        {},
      ),
    ).resolves.toBeDefined();
    expect(storage.createDownloadStream).toHaveBeenCalled();
  });

  it('keeps legacy standalone ISSUE attachments read-only', async () => {
    const { service, document, storage } = createService();
    const unlinkedDocument = document as unknown as {
      sourceTransferId: string | null;
      sourceTransfer: { sourceResponsiblePersonId: string } | null;
    };
    unlinkedDocument.sourceTransferId = null;
    unlinkedDocument.sourceTransfer = null;

    await expect(
      service.upload('document-id', uploadedFile(), owner, {}),
    ).rejects.toThrow('доступні лише для перегляду');
    expect(storage.store).not.toHaveBeenCalled();
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

  it('does not allow an unrelated MVO to preview a child ISSUE attachment', async () => {
    const { service, storage } = createService(StockDocumentStatus.POSTED);
    await expect(
      service.preview(
        'document-id',
        'attachment-id',
        {
          ...owner,
          id: '44444444-4444-4444-8444-444444444444',
          role: UserRole.MVO,
          responsiblePersonId: '55555555-5555-4555-8555-555555555555',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.createDownloadStream).not.toHaveBeenCalled();
  });

  it('does not grant attachment access to the transfer recipient MVO', async () => {
    const { service, storage, document } = createService();
    const recipientId = '33333333-3333-4333-8333-333333333333';
    (
      document as unknown as {
        destinationResponsiblePersonId: string | null;
      }
    ).destinationResponsiblePersonId = recipientId;

    await expect(
      service.preview(
        'document-id',
        'attachment-id',
        {
          ...owner,
          id: '44444444-4444-4444-8444-444444444444',
          role: UserRole.MVO,
          responsiblePersonId: recipientId,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.createDownloadStream).not.toHaveBeenCalled();
  });

  it('requires attachmentId to belong to documentId and returns 404 otherwise', async () => {
    const { service, prisma, storage } = createService();
    prisma.stockDocumentAttachment.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.preview('other-document', 'attachment-id', owner, {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.stockDocumentAttachment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attachment-id', documentId: 'other-document' },
      }),
    );
    expect(storage.createDownloadStream).not.toHaveBeenCalled();
  });

  it('rejects unsafe or unsupported MIME for inline rendering', async () => {
    const { service, prisma } = createService();
    prisma.stockDocumentAttachment.findFirst.mockImplementationOnce(
      async () => ({
        id: 'attachment-id',
        documentId: 'document-id',
        originalFileName: 'invoice.svg',
        storedFileName: 'stored.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 100,
        sha256: 'hash',
        storagePath: 'stored.svg',
        uploadedByUserId: owner.id,
        createdAt: new Date(),
        document: {
          id: 'document-id',
          type: StockDocumentType.ISSUE,
          status: StockDocumentStatus.POSTED,
          createdByUserId: owner.id,
          sourceResponsiblePersonId: sourceId,
          destinationResponsiblePersonId: null,
          sourceTransferId: 'transfer-id',
          sourceTransfer: { sourceResponsiblePersonId: sourceId },
          lines: [],
        },
      }),
    );

    await expect(
      service.preview('document-id', 'attachment-id', owner, {}),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('does not delete an attachment after the ISSUE is POSTED', async () => {
    const { service, storage } = createService(StockDocumentStatus.POSTED);
    await expect(
      service.remove('document-id', 'attachment-id', owner, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.stageForDeletion).not.toHaveBeenCalled();
  });
});
