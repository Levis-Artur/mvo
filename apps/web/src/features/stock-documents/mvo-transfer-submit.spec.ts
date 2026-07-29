import type { StockDocument, StockDocumentInput } from '@/lib/types';
import { submitNewMvoTransfer } from './mvo-transfer-submit';

const input: StockDocumentInput = {
  type: 'MVO_TRANSFER',
  documentDate: '2026-07-29T00:00:00.000Z',
  sourceResponsiblePersonId: '11111111-1111-4111-8111-111111111111',
  destinationResponsiblePersonId: '22222222-2222-4222-8222-222222222222',
  note: 'Передача',
  lines: [
    {
      inventoryItemId: '33333333-3333-4333-8333-333333333333',
      sourceBalanceId: '44444444-4444-4444-8444-444444444444',
      quantity: '2',
    },
  ],
};

describe('new MVO transfer submission', () => {
  it('uses the single atomic create-and-post call without trusted source data', async () => {
    const createAndPost = jest
      .fn()
      .mockResolvedValue({ status: 'POSTED' } as StockDocument);

    await submitNewMvoTransfer(input, createAndPost);

    expect(createAndPost).toHaveBeenCalledTimes(1);
    expect(createAndPost).toHaveBeenCalledWith({
      documentDate: input.documentDate,
      destinationResponsiblePersonId: input.destinationResponsiblePersonId,
      note: input.note,
      lines: input.lines,
    });
    expect(createAndPost.mock.calls[0][0]).not.toHaveProperty(
      'sourceResponsiblePersonId',
    );
    expect(createAndPost.mock.calls[0][0]).not.toHaveProperty('type');
  });

  it('propagates an API failure so the open form can preserve its state', async () => {
    const createAndPost = jest
      .fn()
      .mockRejectedValue(new Error('Недостатній залишок'));

    await expect(
      submitNewMvoTransfer(input, createAndPost),
    ).rejects.toThrow('Недостатній залишок');
  });
});
