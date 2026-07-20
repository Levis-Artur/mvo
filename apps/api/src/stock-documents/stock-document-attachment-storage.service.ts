import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  lstat,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, extname, resolve, sep } from 'node:path';
import { attachmentFileSizeLimitBytes } from '../config/env';

const MIME_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],
  'application/pdf': ['.pdf'],
} as const;

type AllowedMimeType = keyof typeof MIME_EXTENSIONS;

export type StoredAttachment = {
  originalFileName: string;
  storedFileName: string;
  mimeType: AllowedMimeType;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
};

export type StagedAttachmentFile = {
  storagePath: string;
  stagedStoragePath: string;
};

@Injectable()
export class StockDocumentAttachmentStorageService implements OnModuleInit {
  private readonly logger = new Logger(
    StockDocumentAttachmentStorageService.name,
  );

  async onModuleInit() {
    await this.ensureRoot();
  }

  async store(file: Express.Multer.File): Promise<StoredAttachment> {
    this.validateFile(file);
    await this.ensureRoot();

    const originalFileName = this.safeOriginalFilename(file.originalname);
    const extension = extname(originalFileName).toLowerCase();
    const storedFileName = `${randomUUID()}${extension}`;
    const storagePath = storedFileName;
    const absolutePath = this.absolutePath(storagePath);
    await writeFile(absolutePath, file.buffer, { flag: 'wx', mode: 0o600 });

    return {
      originalFileName,
      storedFileName,
      mimeType: file.mimetype as AllowedMimeType,
      sizeBytes: file.size,
      sha256: createHash('sha256').update(file.buffer).digest('hex'),
      storagePath,
    };
  }

  async removeAfterMetadataFailure(storagePath: string): Promise<void> {
    try {
      await unlink(this.absolutePath(storagePath));
    } catch (error) {
      this.logger.error(
        `Attachment cleanup failed after metadata error: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Не вдалося очистити файл після помилки збереження метаданих',
      );
    }
  }

  async stageForDeletion(
    storagePath: string,
  ): Promise<StagedAttachmentFile> {
    const stagedStoragePath = `.deleting-${randomUUID()}`;
    try {
      await rename(
        this.absolutePath(storagePath),
        this.absolutePath(stagedStoragePath),
      );
    } catch (error) {
      this.logger.error(
        `Attachment staging failed: ${this.errorMessage(error)}`,
      );
      throw new InternalServerErrorException(
        'Не вдалося підготувати файл вкладення до видалення',
      );
    }
    return { storagePath, stagedStoragePath };
  }

  async restoreStaged(files: StagedAttachmentFile[]): Promise<void> {
    const failures: string[] = [];
    for (const file of [...files].reverse()) {
      try {
        await rename(
          this.absolutePath(file.stagedStoragePath),
          this.absolutePath(file.storagePath),
        );
      } catch (error) {
        failures.push(this.errorMessage(error));
      }
    }
    if (failures.length) {
      this.logger.error(`Attachment rollback failed: ${failures.join('; ')}`);
      throw new InternalServerErrorException(
        'Не вдалося відновити файли після помилки операції',
      );
    }
  }

  async finalizeDeletion(files: StagedAttachmentFile[]): Promise<void> {
    const failures: string[] = [];
    for (const file of files) {
      try {
        await unlink(this.absolutePath(file.stagedStoragePath));
      } catch (error) {
        failures.push(this.errorMessage(error));
      }
    }
    if (failures.length) {
      this.logger.error(`Attachment deletion failed: ${failures.join('; ')}`);
      throw new InternalServerErrorException(
        'Метадані видалено, але фізичне очищення частини файлів не завершено',
      );
    }
  }

  async assertStoredFilesExist(storagePaths: string[]): Promise<void> {
    for (const storagePath of storagePaths) {
      try {
        await access(this.absolutePath(storagePath));
        const stats = await lstat(this.absolutePath(storagePath));
        if (!stats.isFile() || stats.isSymbolicLink()) throw new Error();
      } catch {
        throw new InternalServerErrorException(
          'Файл вкладення відсутній у захищеному сховищі',
        );
      }
    }
  }

  createDownloadStream(storagePath: string) {
    return createReadStream(this.absolutePath(storagePath));
  }

  async listStoredFileNames(): Promise<string[]> {
    await this.ensureRoot();
    const entries = await readdir(this.rootDirectory(), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  }

  private validateFile(file: Express.Multer.File | undefined): void {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл вкладення відсутній або порожній');
    }
    if (file.size !== file.buffer.length) {
      throw new BadRequestException('Розмір вкладення не відповідає вмісту');
    }
    if (file.size > attachmentFileSizeLimitBytes()) {
      throw new BadRequestException(
        `Розмір вкладення перевищує дозволені ${attachmentFileSizeLimitBytes()} байт`,
      );
    }

    const mimeType = file.mimetype as AllowedMimeType;
    const allowedExtensions = MIME_EXTENSIONS[mimeType];
    if (!allowedExtensions) {
      throw new BadRequestException('Непідтримуваний MIME-тип вкладення');
    }
    const safeName = this.safeOriginalFilename(file.originalname);
    const extension = extname(safeName).toLowerCase();
    if (!(allowedExtensions as readonly string[]).includes(extension)) {
      throw new BadRequestException(
        'Розширення файлу не відповідає заявленому MIME-типу',
      );
    }
    if (!this.magicBytesMatch(mimeType, file.buffer)) {
      throw new BadRequestException(
        'Вміст файлу не відповідає заявленому типу',
      );
    }
  }

  private safeOriginalFilename(value: string): string {
    if (!value || value.includes('/') || value.includes('\\')) {
      throw new BadRequestException('Назва вкладення містить шлях');
    }
    const safeBasename = Array.from(basename(value))
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && (code < 127 || code > 159);
      })
      .join('')
      .trim();
    if (!safeBasename || safeBasename === '.' || safeBasename === '..') {
      throw new BadRequestException('Некоректна назва вкладення');
    }
    if (safeBasename.length <= 255) return safeBasename;
    const extension = extname(safeBasename);
    return extension.length < 255
      ? `${safeBasename.slice(0, 255 - extension.length)}${extension}`
      : safeBasename.slice(0, 255);
  }

  private magicBytesMatch(mimeType: AllowedMimeType, buffer: Buffer): boolean {
    if (mimeType === 'image/jpeg') {
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (mimeType === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (mimeType === 'image/webp') {
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    if (mimeType === 'application/pdf') {
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    if (buffer.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
    const brand = buffer.subarray(8, 12).toString('ascii');
    return mimeType === 'image/heic'
      ? ['heic', 'heix', 'hevc', 'hevx'].includes(brand)
      : ['heif', 'mif1', 'msf1'].includes(brand);
  }

  private rootDirectory(): string {
    return resolve(
      process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR ??
        'storage/stock-document-attachments',
    );
  }

  private absolutePath(storagePath: string): string {
    if (!storagePath || basename(storagePath) !== storagePath) {
      throw new InternalServerErrorException(
        'Некоректний внутрішній шлях вкладення',
      );
    }
    const root = this.rootDirectory();
    const target = resolve(root, storagePath);
    if (!target.startsWith(`${root}${sep}`)) {
      throw new InternalServerErrorException(
        'Некоректний внутрішній шлях вкладення',
      );
    }
    return target;
  }

  private ensureRoot() {
    return mkdir(this.rootDirectory(), { recursive: true, mode: 0o700 });
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
