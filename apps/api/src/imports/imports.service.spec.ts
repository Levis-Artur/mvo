import { BadRequestException } from '@nestjs/common';
import {
  ImportRowStatus,
  ImportStatus,
  ImportType,
  UserRole,
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
    securityEvent: { create: jest.fn() },
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
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockTransaction: {
      findFirst: jest.fn(),
    },
    securityEvent: { create: jest.fn() },
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

function arrangeResponsiblePersonUpload(
  context: ReturnType<typeof createService>,
  counterpartyRaw: string,
) {
  context.parser.parse.mockReturnValue({
    fileHash: `matching-${counterpartyRaw}`,
    encoding: 'utf-8',
    delimiter: ';',
    totalRows: 1,
    rows: [
      {
        rowNumber: 2,
        status: 'VALID',
        counterpartyRaw,
        nomenclatureCodeRaw: '0001',
        itemNameRaw: 'Позиція',
        unitOfMeasureRaw: 'шт',
        parsedQuantity: '1',
        message: '',
      },
    ],
  });
  context.prisma.importBatch.findUnique.mockResolvedValue(null);
  context.prisma.inventoryItem.findUnique.mockResolvedValue({
    id: 'item',
    name: 'Позиція',
  });
  context.prisma.importBatch.create.mockResolvedValue({ id: 'batch' });
}

function uploadResponsiblePersonFixture(
  service: ImportsService,
) {
  return service.upload({
    file: {
      originalname: 'matching.csv',
      buffer: Buffer.from('content'),
      size: 7,
    } as Express.Multer.File,
    importType: ImportType.INITIAL_BALANCE,
    maxFileSizeBytes: 1024,
  });
}

describe('ImportsService', () => {
  it('matches an active responsible person by trimmed exact accounting name', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, '  Точна назва МВО  ');
    context.prisma.responsiblePerson.findFirst.mockResolvedValue({
      id: 'person-by-name',
    });

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findFirst).toHaveBeenCalledWith({
      where: {
        externalAccountingName: 'Точна назва МВО',
        isActive: true,
      },
    });
    expect(context.prisma.responsiblePerson.findMany).not.toHaveBeenCalled();
    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: 'person-by-name',
                status: ImportRowStatus.VALID,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('does not query by code or return a random person when code is absent', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, '  Невідомий контрагент  ');
    context.prisma.responsiblePerson.findFirst.mockResolvedValue(null);

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findMany).not.toHaveBeenCalled();
    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorRows: 1,
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: undefined,
                status: ImportRowStatus.ERROR,
                message: 'МВО не знайдено',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('matches one active responsible person by external accounting code', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, 'Контрагент_0042');
    context.prisma.responsiblePerson.findFirst.mockResolvedValue(null);
    context.prisma.responsiblePerson.findMany.mockResolvedValue([
      { id: 'person-by-code' },
    ]);

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findMany).toHaveBeenCalledWith({
      where: { externalAccountingCode: '0042', isActive: true },
      take: 2,
    });
    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: 'person-by-code',
                status: ImportRowStatus.VALID,
              }),
            ],
          },
        }),
      }),
    );
  });

  it('marks the row as ERROR when an external code has multiple matches', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, 'Контрагент_0042');
    context.prisma.responsiblePerson.findFirst.mockResolvedValue(null);
    context.prisma.responsiblePerson.findMany.mockResolvedValue([
      { id: 'first-person' },
      { id: 'second-person' },
    ]);

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorRows: 1,
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: undefined,
                status: ImportRowStatus.ERROR,
                message:
                  'Неоднозначне зіставлення МВО за зовнішнім кодом',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('ignores inactive responsible persons during automatic matching', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, 'Неактивний МВО_0099');
    context.prisma.responsiblePerson.findFirst.mockResolvedValue(null);
    context.prisma.responsiblePerson.findMany.mockResolvedValue([]);

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findFirst).toHaveBeenCalledWith({
      where: {
        externalAccountingName: 'Неактивний МВО_0099',
        isActive: true,
      },
    });
    expect(context.prisma.responsiblePerson.findMany).toHaveBeenCalledWith({
      where: { externalAccountingCode: '0099', isActive: true },
      take: 2,
    });
    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: undefined,
                status: ImportRowStatus.ERROR,
                message: 'МВО не знайдено',
              }),
            ],
          },
        }),
      }),
    );
  });

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

    await expect(
      service.commit('batch', {
        actor: {
          id: '11111111-1111-4111-8111-111111111111',
          username: 'accountant',
          role: UserRole.ACCOUNTANT,
          isActive: true,
          mustChangePassword: false,
          responsiblePersonId: null,
        },
        context: { requestId: 'request-import-1' },
      }),
    ).resolves.toEqual(
      expect.objectContaining({ importedRows: 2 }),
    );
    expect(tx.inventoryItem.upsert).toHaveBeenCalledTimes(1);
    expect(tx.inventoryItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { externalCode: '002' } }),
    );
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledTimes(2);
    expect(stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        accountingModel: 'DIRECT_BALANCE',
        bucketKind: 'DIRECT',
      }),
    );
    expect(tx.importRow.update).toHaveBeenCalledTimes(2);
    expect(tx.importBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ImportStatus.COMPLETED,
          importedRows: 2,
        }),
      }),
    );
    expect(tx.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'request-import-1',
          success: true,
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
