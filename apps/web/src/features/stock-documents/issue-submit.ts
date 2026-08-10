import type {
  CreateTransferIssueInput,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';

export type CreateAndPostIssue = (
  transferId: string,
  input: CreateTransferIssueInput,
  files: File[],
) => Promise<StockDocument>;

export async function submitNewIssue(
  transferId: string,
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
    transferId,
    {
      documentDate: input.documentDate,
      recipientName: input.recipientName.trim(),
      recipientUnit: input.recipientUnit,
      basis: input.basis,
      note: input.note,
      lines: input.lines.map((line) => {
        if (!line.sourceTransferLineId) {
          throw new Error('Вибрана позиція не пов’язана з передачею');
        }
        return {
          sourceTransferLineId: line.sourceTransferLineId,
          quantity: line.quantity,
          note: line.note,
        };
      }),
    },
    files,
  );
}
