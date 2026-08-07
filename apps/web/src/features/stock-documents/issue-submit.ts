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
      note: input.note,
      lines: input.lines,
    },
    files,
  );
}
