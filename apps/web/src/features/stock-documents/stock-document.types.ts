import type {
  AuthUser,
  ResponsiblePerson,
  StockBalance,
  StockDocument,
  StockDocumentInput,
  StockDocumentType,
} from '@/lib/types';

export type DocumentFormLine = { inventoryItemId: string; quantity: string; note: string };

export type StockDocumentFormProps = {
  user: AuthUser;
  type: StockDocumentType;
  document?: StockDocument | null;
  initialSourceId: string;
  persons: ResponsiblePerson[];
  transferTargets: ResponsiblePerson[];
  balances: StockBalance[];
  loadingBalances: boolean;
  loadingTargets: boolean;
  saving: boolean;
  error: string;
  targetsError: string;
  onSourceChange: (id: string) => void;
  onSubmit: (input: StockDocumentInput) => Promise<void>;
  onClose: () => void;
};
