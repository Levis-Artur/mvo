import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  StockDocumentType,
  TransferTarget,
} from '@/lib/types';

export type DocumentFormLine = {
  inventoryItemId: string;
  sourceBalanceId: string;
  quantity: string;
  note: string;
};

export type StockDocumentFormProps = {
  user: AuthUser;
  type: StockDocumentType;
  document?: StockDocument | null;
  initialSourceId: string;
  persons: ResponsiblePerson[];
  transferTargets: TransferTarget[];
  availableSources: AvailableStockSource[];
  loadingSources: boolean;
  loadingTargets: boolean;
  saving: boolean;
  error: string;
  sourcesError: string;
  targetsError: string;
  onSourceChange: (id: string) => Promise<void> | void;
  onSubmit: (input: StockDocumentInput, files: File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
  onClose: () => void;
};
