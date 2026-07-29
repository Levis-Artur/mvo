import type {
  CreateMvoTransferInput,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';

export type CreateAndPostMvoTransfer = (
  input: CreateMvoTransferInput,
) => Promise<StockDocument>;

export function submitNewMvoTransfer(
  input: StockDocumentInput,
  createAndPost: CreateAndPostMvoTransfer,
) {
  if (input.type !== 'MVO_TRANSFER') {
    throw new Error('Очікувався документ передачі між МВО');
  }
  if (!input.destinationResponsiblePersonId) {
    throw new Error('Для передачі обов’язково вкажіть МВО-одержувача');
  }

  return createAndPost({
    documentDate: input.documentDate,
    destinationResponsiblePersonId: input.destinationResponsiblePersonId,
    note: input.note,
    lines: input.lines,
  });
}
