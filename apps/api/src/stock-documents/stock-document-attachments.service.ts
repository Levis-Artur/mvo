import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StockDocumentStatus,
  StockDocumentType,
  UserRole,
} from '@prisma/client';
import type { CurrentUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StockDocumentAttachmentStorageService } from './stock-document-attachment-storage.service';

const publicAttachmentSelect = {
  id: true,
  documentId: true,
  originalFileName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  uploadedByUserId: true,
  uploadedByUser: { select: { id: true, username: true, role: true } },
  createdAt: true,
} satisfies Prisma.StockDocumentAttachmentSelect;

const attachmentDocumentSelect = {
  id: true,
  type: true,
  status: true,
  sourceResponsiblePersonId: true,
  destinationResponsiblePersonId: true,
  lines: { select: { accountingOwnerResponsiblePersonId: true } },
} satisfies Prisma.StockDocumentSelect;

@Injectable()
export class StockDocumentAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StockDocumentAttachmentStorageService,
  ) {}

  async upload(
    documentId: string,
    file: Express.Multer.File,
    actor: CurrentUser,
  ) {
    const document = await this.findDocument(documentId);
    this.assertWriteAccess(actor, document);
    this.assertDraftIssue(document);

    const stored = await this.storage.store(file);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const claim = await tx.stockDocument.updateMany({
          where: {
            id: documentId,
            type: StockDocumentType.ISSUE,
            status: StockDocumentStatus.DRAFT,
          },
          data: { updatedAt: new Date() },
        });
        if (claim.count !== 1) {
          throw new BadRequestException(
            'Вкладення можна додавати лише до чернетки видачі',
          );
        }
        return tx.stockDocumentAttachment.create({
          data: {
            documentId,
            ...stored,
            uploadedByUserId: actor.id,
          },
          select: publicAttachmentSelect,
        });
      });
    } catch (error) {
      await this.storage.removeAfterMetadataFailure(stored.storagePath);
      throw error;
    }
  }

  async list(documentId: string, actor: CurrentUser) {
    const document = await this.findDocument(documentId);
    this.assertReadAccess(actor, document);
    return this.prisma.stockDocumentAttachment.findMany({
      where: { documentId },
      select: publicAttachmentSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async download(
    documentId: string,
    attachmentId: string,
    actor: CurrentUser,
  ) {
    const attachment = await this.prisma.stockDocumentAttachment.findFirst({
      where: { id: attachmentId, documentId },
      include: { document: { select: attachmentDocumentSelect } },
    });
    if (!attachment) throw new NotFoundException('Вкладення не знайдено');
    this.assertReadAccess(actor, attachment.document);
    await this.storage.assertStoredFilesExist([attachment.storagePath]);
    return {
      metadata: {
        id: attachment.id,
        originalFileName: attachment.originalFileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        sha256: attachment.sha256,
      },
      stream: this.storage.createDownloadStream(attachment.storagePath),
    };
  }

  async remove(
    documentId: string,
    attachmentId: string,
    actor: CurrentUser,
  ) {
    const attachment = await this.prisma.stockDocumentAttachment.findFirst({
      where: { id: attachmentId, documentId },
      include: { document: { select: attachmentDocumentSelect } },
    });
    if (!attachment) throw new NotFoundException('Вкладення не знайдено');
    this.assertWriteAccess(actor, attachment.document);
    this.assertDraftIssue(attachment.document);

    const staged = await this.storage.stageForDeletion(attachment.storagePath);
    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.stockDocument.updateMany({
          where: {
            id: documentId,
            type: StockDocumentType.ISSUE,
            status: StockDocumentStatus.DRAFT,
          },
          data: { updatedAt: new Date() },
        });
        if (claim.count !== 1) {
          throw new BadRequestException(
            'Вкладення не можна видаляти після проведення документа',
          );
        }
        const deleted = await tx.stockDocumentAttachment.deleteMany({
          where: { id: attachmentId, documentId },
        });
        if (deleted.count !== 1) {
          throw new NotFoundException('Вкладення не знайдено');
        }
      });
    } catch (error) {
      await this.storage.restoreStaged([staged]);
      throw error;
    }
    await this.storage.finalizeDeletion([staged]);
    return { deleted: true, id: attachmentId };
  }

  async findOrphans() {
    const [metadata, storedFileNames] = await Promise.all([
      this.prisma.stockDocumentAttachment.findMany({
        select: { id: true, storedFileName: true },
      }),
      this.storage.listStoredFileNames(),
    ]);
    const metadataNames = new Set(metadata.map((item) => item.storedFileName));
    const storedNames = new Set(storedFileNames);
    return {
      metadataWithoutFile: metadata
        .filter((item) => !storedNames.has(item.storedFileName))
        .map((item) => ({ attachmentId: item.id })),
      filesWithoutMetadata: storedFileNames
        .filter((name) => !metadataNames.has(name))
        .map((storedFileName) => ({ storedFileName })),
    };
  }

  private async findDocument(id: string) {
    const document = await this.prisma.stockDocument.findUnique({
      where: { id },
      select: attachmentDocumentSelect,
    });
    if (!document) throw new NotFoundException('Документ руху майна не знайдено');
    return document;
  }

  private assertDraftIssue(document: {
    type: StockDocumentType;
    status: StockDocumentStatus;
  }) {
    if (
      document.type !== StockDocumentType.ISSUE ||
      document.status !== StockDocumentStatus.DRAFT
    ) {
      throw new BadRequestException(
        'Вкладення можна змінювати лише у чернетці видачі',
      );
    }
  }

  private assertWriteAccess(
    actor: CurrentUser,
    document: {
      sourceResponsiblePersonId: string;
    },
  ) {
    if (actor.role === UserRole.OWNER || actor.role === UserRole.DPP_ADMIN) {
      return;
    }
    if (
      actor.role === UserRole.MVO &&
      actor.responsiblePersonId === document.sourceResponsiblePersonId
    ) {
      return;
    }
    throw new ForbiddenException('Немає права змінювати вкладення документа');
  }

  private assertReadAccess(
    actor: CurrentUser,
    document: {
      sourceResponsiblePersonId: string;
      destinationResponsiblePersonId: string | null;
      lines: { accountingOwnerResponsiblePersonId: string | null }[];
    },
  ) {
    if (actor.role !== UserRole.MVO) return;
    const responsiblePersonId = actor.responsiblePersonId;
    if (
      responsiblePersonId === document.sourceResponsiblePersonId ||
      responsiblePersonId === document.destinationResponsiblePersonId ||
      document.lines.some(
        (line) =>
          line.accountingOwnerResponsiblePersonId === responsiblePersonId,
      )
    ) {
      return;
    }
    throw new NotFoundException('Документ руху майна не знайдено');
  }
}
