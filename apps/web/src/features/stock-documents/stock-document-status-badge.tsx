import type { StockDocumentStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui';
import { documentStatusPresentation } from './stock-document-rules';

export function StockDocumentStatusBadge({ status }: { status: StockDocumentStatus }) {
  const presentation = documentStatusPresentation(status);
  return <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>;
}
