import type {
  CreateIssueInput,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';

export type CreateAndPostIssue = (
  input: CreateIssueInput,
  files: File[],
) => Promise<StockDocument>;

export async function submitNewIssue(
  input: StockDocumentInput,
  files: File[],
  createAndPost: CreateAndPostIssue,
) {
  if (input.type !== 'ISSUE') {
    throw new Error('Очікувався документ видачі майна');
  }
  if (!input.recipientName?.trim()) {
    throw new Error('Для видачі обов’язково вкажіть одержувача');
  }
  if (!files.length) {
    throw new Error(
      'Для видачі додайте хоча б одне фото або скан накладної',
    );
  }

  return createAndPost(
    {
      documentDate: input.documentDate,
      recipientName: input.recipientName.trim(),
      recipientUnit: input.recipientUnit,
      basis: input.basis,
      note: input.note,
      lines: input.lines.map((line) => {
        if (!line.sourceBalanceId) {
          throw new Error('Вибрана позиція не пов’язана з прямим залишком');
        }
        return {
          inventoryItemId: line.inventoryItemId,
          sourceBalanceId: line.sourceBalanceId,
          quantity: line.quantity,
          note: line.note,
        };
      }),
    },
    files,
  );
}
