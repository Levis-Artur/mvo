import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
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
  initialInventoryItemId?: string;
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
  onClose: () => void;
};
