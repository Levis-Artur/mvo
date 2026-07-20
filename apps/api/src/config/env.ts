import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

type Environment = {
  apiPort: number;
  corsOrigin: string;
  databaseUrl: string;
  maxImportFileSizeBytes: number;
  maxAttachmentFileSizeBytes: number;
  stockDocumentAttachmentsDir: string;
  ownerDestructiveActionsEnabled: boolean;
};

export function loadEnvironment(): void {
  const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const path of envPaths) {
    if (existsSync(path)) {
      config({ path, override: false });
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function validateUrl(name: string, value: string): string {
  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid URL in environment variable: ${name}`);
  }

  return value;
}

function validatePort(value: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function validateEnvironment(): Environment {
  loadEnvironment();

  const apiPort = validatePort(requireEnv('API_PORT'));
  const corsOrigin = validateUrl('CORS_ORIGIN', requireEnv('CORS_ORIGIN'));
  const databaseUrl = validateUrl('DATABASE_URL', requireEnv('DATABASE_URL'));
  const maxImportFileSizeMegabytes = Number(
    process.env.MAX_IMPORT_FILE_SIZE_MB ?? 5,
  );
  const maxImportFileSizeBytes = Number(
    process.env.MAX_IMPORT_FILE_SIZE_BYTES ??
      maxImportFileSizeMegabytes * 1024 * 1024,
  );
  const maxAttachmentFileSizeMegabytes = Number(
    process.env.MAX_ATTACHMENT_FILE_SIZE_MB ?? 10,
  );
  const maxAttachmentFileSizeBytes = Number(
    process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES ??
      maxAttachmentFileSizeMegabytes * 1024 * 1024,
  );
  const stockDocumentAttachmentsDir = resolve(
    process.env.STOCK_DOCUMENT_ATTACHMENTS_DIR ??
      'storage/stock-document-attachments',
  );
  const ownerDestructiveActionsEnabled =
    (process.env.OWNER_DESTRUCTIVE_ACTIONS_ENABLED ?? 'false').toLowerCase() ===
    'true';

  if (corsOrigin === '*') {
    throw new Error('CORS_ORIGIN must be a concrete origin, not *');
  }

  if (
    !Number.isInteger(maxImportFileSizeBytes) ||
    maxImportFileSizeBytes < 1024
  ) {
    throw new Error(
      'MAX_IMPORT_FILE_SIZE_MB must produce an integer file size >= 1024 bytes',
    );
  }

  if (
    !Number.isInteger(maxAttachmentFileSizeBytes) ||
    maxAttachmentFileSizeBytes < 1024
  ) {
    throw new Error(
      'MAX_ATTACHMENT_FILE_SIZE_MB must produce an integer file size >= 1024 bytes',
    );
  }

  return {
    apiPort,
    corsOrigin,
    databaseUrl,
    maxImportFileSizeBytes,
    maxAttachmentFileSizeBytes,
    stockDocumentAttachmentsDir,
    ownerDestructiveActionsEnabled,
  };
}

export function attachmentFileSizeLimitBytes(): number {
  const megabytes = Number(process.env.MAX_ATTACHMENT_FILE_SIZE_MB ?? 10);
  const bytes = Number(
    process.env.MAX_ATTACHMENT_FILE_SIZE_BYTES ?? megabytes * 1024 * 1024,
  );
  return Number.isInteger(bytes) && bytes >= 1024 ? bytes : 10 * 1024 * 1024;
}
