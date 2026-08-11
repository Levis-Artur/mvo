import type { StockDocument, StockDocumentInput } from '@/lib/types';
import { submitNewIssue } from './issue-submit';

const input: StockDocumentInput = {
  type: 'ISSUE',
  documentDate: '2026-08-07T00:00:00.000Z',
  sourceResponsiblePersonId: '11111111-1111-4111-8111-111111111111',
  recipientName: 'Підрозділ забезпечення',
  note: 'Для службового використання',
  lines: [
    {
      inventoryItemId: '22222222-2222-4222-8222-222222222222',
      sourceBalanceId: '33333333-3333-4333-8333-333333333333',
      quantity: '2',
    },
  ],
};

describe('new ISSUE submission', () => {
  it('uses one atomic multipart call without trusted source or draft fields', async () => {
    const files = [{} as File];
    const createAndPost = jest
      .fn()
      .mockResolvedValue({ status: 'POSTED' } as StockDocument);

    await submitNewIssue(input, files, createAndPost);

    expect(createAndPost).toHaveBeenCalledTimes(1);
    expect(createAndPost).toHaveBeenCalledWith(
      {
        documentDate: input.documentDate,
        recipientName: input.recipientName,
        recipientUnit: undefined,
        basis: input.basis,
        note: input.note,
        lines: [
          {
            inventoryItemId: input.lines[0].inventoryItemId,
            sourceBalanceId: input.lines[0].sourceBalanceId,
            quantity: input.lines[0].quantity,
            note: input.lines[0].note,
          },
        ],
      },
      files,
    );
    expect(createAndPost.mock.calls[0][0]).not.toHaveProperty(
      'sourceResponsiblePersonId',
    );
    expect(createAndPost.mock.calls[0][0]).not.toHaveProperty('type');
    expect(createAndPost.mock.calls[0][0]).not.toHaveProperty('sourceTransferId');
    expect(createAndPost.mock.calls[0][0].lines[0]).not.toHaveProperty(
      'sourceTransferLineId',
    );
  });

  it('requires an attachment before making the API call', async () => {
    const createAndPost = jest.fn();

    await expect(
      submitNewIssue(input, [], createAndPost),
    ).rejects.toThrow('додайте хоча б одне фото або скан накладної');
    expect(createAndPost).not.toHaveBeenCalled();
  });

  it('propagates an API error so the form remains open', async () => {
    const createAndPost = jest
      .fn()
      .mockRejectedValue(new Error('Недостатній залишок'));

    await expect(
      submitNewIssue(input, [{} as File], createAndPost),
    ).rejects.toThrow('Недостатній залишок');
  });
});
