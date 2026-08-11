import { BadRequestException } from '@nestjs/common';
import {
  ImportRowStatus,
  ImportStatus,
  ImportType,
  Prisma,
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
    securityEvent: { create: jest.fn(), findMany: jest.fn() },
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    stockTransaction: {
      findFirst: jest.fn(),
    },
    securityEvent: { create: jest.fn(), findMany: jest.fn() },
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
  it('returns the uploader in import history from the existing audit event', async () => {
    const { service, prisma } = createService();
    const batch = {
      id: 'batch-id',
      createdAt: new Date('2026-08-07T10:00:00.000Z'),
    };
    prisma.importBatch.findMany.mockResolvedValue([batch]);
    prisma.importBatch.count.mockResolvedValue(1);
    prisma.securityEvent.findMany.mockResolvedValue([
      {
        metadata: { action: 'UPLOAD', importBatchId: 'batch-id' },
        actorUser: { id: 'accountant-id', username: 'accountant' },
      },
    ]);

    await expect(service.findAll({ page: 1, limit: 20 })).resolves.toEqual({
      items: [{
        ...batch,
        uploadedByUser: { id: 'accountant-id', username: 'accountant' },
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('returns the uploader in import details without exposing an internal user id as display data', async () => {
    const { service, prisma } = createService();
    const batch = { id: 'batch-id', totalRows: 1 };
    prisma.importBatch.findUnique.mockResolvedValue(batch);
    prisma.importRow.findMany.mockResolvedValue([]);
    prisma.securityEvent.findMany.mockResolvedValue([{
      metadata: { action: 'UPLOAD', importBatchId: 'batch-id' },
      actorUser: { id: 'accountant-id', username: 'accountant' },
    }]);

    await expect(service.findOne('batch-id')).resolves.toMatchObject({
      ...batch,
      uploadedByUser: { id: 'accountant-id', username: 'accountant' },
    });
  });

  it('counts distinct matched MVO and new or updated inventory positions', async () => {
    const { service, prisma } = createService();
    prisma.importBatch.findUnique.mockResolvedValue({ id: 'batch-id' });
    prisma.importRow.findMany.mockResolvedValue([
      {
        status: ImportRowStatus.VALID,
        responsiblePersonId: 'person-1',
        inventoryItemId: 'item-1',
        counterpartyRaw: 'МВО_0057',
        nomenclatureCodeRaw: 'A-1',
      },
      {
        status: ImportRowStatus.WARNING,
        responsiblePersonId: 'person-1',
        inventoryItemId: 'item-1',
        counterpartyRaw: 'МВО_0057',
        nomenclatureCodeRaw: 'A-1',
      },
      {
        status: ImportRowStatus.WARNING,
        responsiblePersonId: 'person-2',
        inventoryItemId: null,
        counterpartyRaw: 'Інший МВО_0061',
        nomenclatureCodeRaw: 'NEW-1',
      },
      {
        status: ImportRowStatus.ERROR,
        responsiblePersonId: null,
        inventoryItemId: null,
        counterpartyRaw: 'Невідомий_0099',
        nomenclatureCodeRaw: 'NEW-2',
      },
    ]);

    const result = await service.findOne('batch-id');

    expect(result.preview).toMatchObject({
      matchedPersons: 2,
      missingPersons: 1,
      newItems: 1,
      updatedItems: 1,
      errorRows: 1,
    });
  });

  it('returns the parsed accounting code in preview rows without losing zeros', async () => {
    const { service, prisma } = createService();
    prisma.importBatch.findUnique.mockResolvedValue({ id: 'batch-id' });
    prisma.importRow.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'row-id',
        counterpartyRaw: 'Жигульський А.В._0057',
        parsedQuantity: null,
        systemBalance: null,
        fileEndingBalance: null,
        balanceDifference: null,
        responsiblePerson: null,
        inventoryItem: null,
      }]);
    prisma.importRow.count.mockResolvedValue(1);

    const result = await service.rows('batch-id', { page: 1, limit: 20 });

    expect(result.items[0].externalAccountingCode).toBe('0057');
  });

  it('matches an active responsible person only by exact accounting code', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, '  Жигульський А.В._0057  ');
    context.prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-by-code',
      isActive: true,
    });

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findUnique).toHaveBeenCalledWith({
      where: { externalAccountingCode: '0057' },
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

  it('does not query or match by name when the accounting code is absent', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, '  Жигульський А.В.  ');

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findUnique).not.toHaveBeenCalled();
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
                  'Не вдалося визначити код МВО з колонки "Контрагент".',
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
    context.prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-by-code',
      isActive: true,
    });

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findUnique).toHaveBeenCalledWith({
      where: { externalAccountingCode: '0042' },
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

  it('does not fall back to a matching accounting name for an unknown code', async () => {
    const context = createService();
    arrangeResponsiblePersonUpload(context, 'Відоме бухгалтерське ім’я_0042');
    context.prisma.responsiblePerson.findUnique.mockResolvedValue(null);

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
                message: 'МВО з кодом 0042 не знайдено.',
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
    context.prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'inactive-person',
      isActive: false,
    });

    await uploadResponsiblePersonFixture(context.service);

    expect(context.prisma.responsiblePerson.findUnique).toHaveBeenCalledWith({
      where: { externalAccountingCode: '0099' },
    });
    expect(context.prisma.importBatch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rows: {
            create: [
              expect.objectContaining({
                responsiblePersonId: undefined,
                status: ImportRowStatus.ERROR,
                message: 'МВО з кодом 0099 деактивований.',
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
    prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person',
      isActive: true,
    });
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

  it('completes upload, preview, validate and commit for ACCOUNTANT and updates StockBalance through the importer', async () => {
    const context = createService();
    const actor = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'accountant',
      role: UserRole.ACCOUNTANT,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    };
    let batch: Record<string, unknown> | null = null;
    let row: Record<string, unknown> | null = null;
    let directBalance = new Prisma.Decimal(0);

    context.parser.parse.mockReturnValue({
      fileHash: 'accountant-flow-hash',
      encoding: 'utf-8',
      delimiter: ';',
      totalRows: 1,
      rows: [{
        rowNumber: 2,
        status: ImportRowStatus.VALID,
        counterpartyRaw: 'Бухгалтерський МВО_0057',
        nomenclatureCodeRaw: 'ITEM-001',
        itemNameRaw: 'Клавіатура',
        unitOfMeasureRaw: 'шт.',
        parsedQuantity: '5',
        message: '',
      }],
    });
    context.prisma.responsiblePerson.findUnique.mockResolvedValue({
      id: 'person-0057',
      isActive: true,
    });
    context.prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'item-001',
      externalCode: 'ITEM-001',
      name: 'Клавіатура',
      unitOfMeasure: 'шт.',
    });
    context.prisma.importBatch.findUnique.mockImplementation(({ where }) => {
      if ('fileHash' in where) return Promise.resolve(null);
      return Promise.resolve(batch);
    });
    context.prisma.importBatch.create.mockImplementation(({ data }) => {
      const createdRow = data.rows.create[0];
      row = { id: 'row-1', importBatchId: 'batch-1', ...createdRow };
      batch = { id: 'batch-1', ...data };
      return Promise.resolve(batch);
    });
    context.prisma.importBatch.findMany.mockImplementation(() =>
      Promise.resolve(batch ? [batch] : []),
    );
    context.prisma.importBatch.count.mockImplementation(() =>
      Promise.resolve(batch ? 1 : 0),
    );
    context.prisma.importBatch.update.mockImplementation(({ data }) => {
      batch = { ...batch, ...data };
      return Promise.resolve(batch);
    });
    context.prisma.importRow.findMany.mockImplementation(() =>
      Promise.resolve(row ? [row] : []),
    );
    context.prisma.importRow.count.mockImplementation(() =>
      Promise.resolve(row ? 1 : 0),
    );
    context.prisma.importRow.update.mockImplementation(({ data }) => {
      row = { ...row, ...data };
      return Promise.resolve(row);
    });
    context.tx.importBatch.findUnique.mockImplementation(() =>
      Promise.resolve(batch),
    );
    context.tx.importBatch.update.mockImplementation(({ data }) => {
      batch = { ...batch, ...data };
      return Promise.resolve(batch);
    });
    context.tx.importRow.findMany.mockImplementation(() =>
      Promise.resolve(row ? [row] : []),
    );
    context.tx.importRow.update.mockImplementation(({ data }) => {
      row = { ...row, ...data };
      return Promise.resolve(row);
    });
    context.stock.createIncreasingTransactionInTx.mockImplementation(
      (_tx, input) => {
        directBalance = directBalance.plus(input.quantity);
        return Promise.resolve({ balanceAfter: directBalance });
      },
    );

    const uploaded = await context.service.upload({
      file: {
        originalname: 'balances.csv',
        buffer: Buffer.from('content'),
        size: 7,
      } as Express.Multer.File,
      importType: ImportType.RECEIPT,
      maxFileSizeBytes: 1024,
      audit: { actor, context: { requestId: 'upload-request' } },
    });
    const history = await context.service.findAll({ page: 1, limit: 20 });
    const preview = await context.service.findOne('batch-1');
    const previewRows = await context.service.rows('batch-1', { page: 1, limit: 20 });
    const validated = await context.service.validate('batch-1', {
      actor,
      context: { requestId: 'validate-request' },
    });
    const committed = await context.service.commit('batch-1', {
      actor,
      context: { requestId: 'commit-request' },
    });

    expect(uploaded).toMatchObject({ id: 'batch-1', status: ImportStatus.VALIDATED });
    expect(history.pagination.total).toBe(1);
    expect(preview.preview).toMatchObject({ validRows: 1, matchedPersons: 1 });
    expect(previewRows.items).toHaveLength(1);
    expect(validated).toMatchObject({ status: ImportStatus.VALIDATED });
    expect(committed).toMatchObject({
      status: ImportStatus.COMPLETED,
      importedRows: 1,
    });
    expect(directBalance.toString()).toBe('5');
    expect(context.stock.createIncreasingTransactionInTx).toHaveBeenCalledWith(
      context.tx,
      expect.objectContaining({
        responsiblePersonId: 'person-0057',
        inventoryItemId: 'item-001',
        quantity: '5',
        accountingModel: 'DIRECT_BALANCE',
        bucketKind: 'DIRECT',
      }),
    );
    expect(context.tx.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: actor.id,
          requestId: 'commit-request',
          success: true,
        }),
      }),
    );
    expect(
      context.prisma.securityEvent.create.mock.calls.map(
        ([input]) => input.data.metadata.action,
      ),
    ).toEqual(['UPLOAD', 'VALIDATE']);
  });

  it('allows an unfinished import to be cancelled with ACCOUNTANT audit context', async () => {
    const { service, prisma } = createService();
    const actor = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'accountant',
      role: UserRole.ACCOUNTANT,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    };
    prisma.importBatch.findUnique.mockResolvedValue({
      id: 'batch-id',
      status: ImportStatus.VALIDATED,
    });
    prisma.importRow.findMany.mockResolvedValue([]);
    prisma.importBatch.update.mockResolvedValue({
      id: 'batch-id',
      status: ImportStatus.CANCELLED,
    });

    await expect(service.cancel('batch-id', {
      actor,
      context: { requestId: 'cancel-request' },
    })).resolves.toMatchObject({ status: ImportStatus.CANCELLED });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'IMPORT_ACTION',
        actorUserId: actor.id,
        requestId: 'cancel-request',
        success: true,
        metadata: expect.objectContaining({
          importBatchId: 'batch-id',
          action: 'CANCEL',
        }),
      }),
    });
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
