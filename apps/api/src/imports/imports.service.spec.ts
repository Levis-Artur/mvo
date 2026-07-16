import { BadRequestException } from '@nestjs/common';
import {
  ImportRowStatus,
  ImportStatus,
  ImportType,
} from '@prisma/client';
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
    expect(prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalFilename: 'test.csv',
          validRows: 0,
          warningRows: 0,
          errorRows: 0,
          skippedRows: 1,
          rows: {
            create: [
              expect.objectContaining({
                status: ImportRowStatus.SKIPPED,
                inventoryItemId: undefined,
                message:
                  'Рядок із нульовою кількістю пропущено',
              }),
            ],
          },
        }),
      }),
    );
    expect(prisma.inventoryItem.findUnique).toHaveBeenCalled();
  });

  it('keeps a zero INITIAL_BALANCE row SKIPPED after validation', async () => {
    const { service, prisma } = createService();
    prisma.importBatch.findUnique.mockResolvedValue({
      id: 'batch',
      status: ImportStatus.VALIDATED,
    });
    prisma.importRow.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'skipped-row',
          status: ImportRowStatus.SKIPPED,
          message: 'Рядок із нульовою кількістю пропущено',
        },
      ]);
    prisma.importBatch.update.mockResolvedValue({
      id: 'batch',
      status: ImportStatus.VALIDATED,
      skippedRows: 1,
    });

    await expect(service.validate('batch')).resolves.toEqual(
      expect.objectContaining({ skippedRows: 1 }),
    );
    expect(prisma.importRow.update).not.toHaveBeenCalled();
    expect(prisma.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          warningRows: 0,
          skippedRows: 1,
        }),
      }),
    );
  });

  it('commits VALID and WARNING rows while ignoring SKIPPED rows', async () => {
    const { service, prisma, tx, stock } = createService();
    const commitRows = [
      {
        id: 'valid-row',
        status: ImportRowStatus.VALID,
        responsiblePersonId: 'person',
        inventoryItemId: 'item',
        nomenclatureCodeRaw: '001',
        itemNameRaw: 'Item 1',
        parsedQuantity: '5',
      },
      {
        id: 'warning-row',
        status: ImportRowStatus.WARNING,
        responsiblePersonId: 'person',
        inventoryItemId: null,
        nomenclatureCodeRaw: '002',
        itemNameRaw: 'Item 2',
        unitOfMeasureRaw: 'шт',
        parsedQuantity: '3',
      },
      {
        id: 'skipped-row',
        status: ImportRowStatus.SKIPPED,
        responsiblePersonId: 'person',
        inventoryItemId: null,
        nomenclatureCodeRaw: '003',
        itemNameRaw: 'Item 3',
        parsedQuantity: null,
      },
    ];
    tx.importBatch.findUnique.mockResolvedValue({
      id: 'batch',
      type: ImportType.INITIAL_BALANCE,
      status: ImportStatus.VALIDATED,
      errorRows: 0,
      originalFilename: 'test.csv',
    });
    tx.importRow.findMany.mockResolvedValue(commitRows);
    tx.stockTransaction.findFirst.mockResolvedValue(null);
    tx.inventoryItem.upsert.mockResolvedValue({ id: 'new-item' });
    stock.createIncreasingTransactionInTx
      .mockResolvedValueOnce({ balanceAfter: '5' })
      .mockResolvedValueOnce({ balanceAfter: '3' });
    tx.importRow.update.mockResolvedValue({});
    tx.importBatch.update.mockResolvedValue({});
    prisma.importBatch.findUnique.mockResolvedValue({
      id: 'batch',
      status: ImportStatus.COMPLETED,
      importedRows: 2,
    });
    prisma.importRow.findMany.mockResolvedValue(commitRows);

    await expect(service.commit('batch')).resolves.toEqual(
      expect.objectContaining({ importedRows: 2 }),
    );
    expect(tx.inventoryItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.inventoryItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalCode: '002' } }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledTimes(2);
    expect(tx.importRow.update).toHaveBeenCalledTimes(2);
    expect(tx.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ImportStatus.COMPLETED,
          importedRows: 2,
        }),
      }),
    );
  });

  it('stores and returns the normalized upload filename', async () => {
    const { service, prisma, parser } = createService();
    const expectedFilename = 'Залишки майна.csv';
    const uploadedFilename = Buffer.from(expectedFilename, 'utf8').toString(
      'latin1',
    );
    parser.parse.mockReturnValue({
      fileHash: 'normalized-name-hash',
      encoding: 'utf-8',
      delimiter: ',',
      totalRows: 0,
      rows: [],
    });
    prisma.importBatch.findUnique.mockResolvedValue(null);
    prisma.importBatch.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'batch', ...data }),
    );

    const result = await service.upload({
      file: {
        originalname: uploadedFilename,
        buffer: Buffer.from('content'),
        size: 7,
      } as Express.Multer.File,
      importType: ImportType.INITIAL_BALANCE,
      maxFileSizeBytes: 1024,
    });

    expect(prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          originalFilename: expectedFilename,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ originalFilename: expectedFilename }),
    );
  });
});
