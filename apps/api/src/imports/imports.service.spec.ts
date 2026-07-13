import { BadRequestException } from '@nestjs/common';
import { ImportStatus, ImportType } from '@prisma/client';
import { ImportsService } from './imports.service';

function createService(overrides: Record<string, unknown> = {}) {
  const tx = {
    importBatch: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    importRow: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    stockTransaction: {
      findFirst: jest.fn(),
    },
    inventoryItem: {
      upsert: jest.fn(),
    },
  };
  const prisma = {
    importBatch: {
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    importRow: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    stockBalance: {
      findUnique: jest.fn(),
    },
    inventoryItem: {
      findUnique: jest.fn(),
    },
    responsiblePerson: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockTransaction: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    ...overrides,
  };
  const parser = {
    parse: jest.fn(),
    parseQuantity: jest.fn(),
  };
  const stock = {
    createIncreasingTransactionInTx: jest.fn(),
  };

  return {
    service: new ImportsService(
      prisma as never,
      parser as never,
      stock as never,
    ),
    prisma,
    tx,
    parser,
    stock,
  };
}

describe('ImportsService', () => {
  it('blocks commit for UPLOADED batch', async () => {
    const { service, tx } = createService();
    tx.importBatch.findUnique.mockResolvedValue({
      id: 'batch',
      type: ImportType.RECEIPT,
      status: ImportStatus.UPLOADED,
      errorRows: 0,
    });

    await expect(service.commit('batch')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks commit for batch with errors', async () => {
    const { service, tx } = createService();
    tx.importBatch.findUnique.mockResolvedValue({
      id: 'batch',
      type: ImportType.RECEIPT,
      status: ImportStatus.VALIDATED,
      errorRows: 1,
    });

    await expect(service.commit('batch')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('upload creates preview rows without touching balances', async () => {
    const { service, prisma, parser } = createService();
    parser.parse.mockReturnValue({
      fileHash: 'hash',
      encoding: 'windows-1251',
      delimiter: '\t',
      totalRows: 1,
      rows: [
        {
          rowNumber: 2,
          status: 'SKIPPED',
          counterpartyRaw: 'Тестовий О.Д._0619',
          nomenclatureCodeRaw: '0001',
          itemNameRaw: 'Позиція',
          parsedQuantity: '0',
          message: 'Рядок із нульовою кількістю пропущено',
        },
      ],
    });
    prisma.importBatch.findUnique.mockResolvedValue(null);
    prisma.responsiblePerson.findFirst.mockResolvedValue({ id: 'person' });
    prisma.inventoryItem.findUnique.mockResolvedValue(null);
    prisma.importBatch.create.mockResolvedValue({ id: 'batch' });

    await expect(
      service.upload({
        file: {
          originalname: 'test.csv',
          buffer: Buffer.from('content'),
          size: 7,
        } as Express.Multer.File,
        importType: ImportType.INITIAL_BALANCE,
        maxFileSizeBytes: 1024,
      }),
    ).resolves.toEqual({ id: 'batch' });
    expect(prisma.stockBalance.findUnique).not.toHaveBeenCalled();
  });
});
