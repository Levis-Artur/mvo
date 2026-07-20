import type {
  AuthUser,
  AvailableStockSource,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  StockDocumentType,
} from '@/lib/types';

export type DocumentFormLine = {
  inventoryItemId: string;
  sourceKind: 'DIRECT' | 'ASSIGNED';
  sourceBalanceId: string;
  accountingOwnerResponsiblePersonId: string;
  sourceCustodianResponsiblePersonId?: string;
  sourceCustodyBalanceId?: string;
  quantity: string;
  note: string;
};

export type StockDocumentFormProps = {
  user: AuthUser;
  type: StockDocumentType;
  document?: StockDocument | null;
  initialSourceId: string;
  initialSourceBalanceId?: string;
  persons: ResponsiblePerson[];
  transferTargets: ResponsiblePerson[];
  availableSources: AvailableStockSource[];
  loadingSources: boolean;
  loadingTargets: boolean;
  saving: boolean;
  error: string;
  targetsError: string;
  onSourceChange: (id: string) => void;
  onSubmit: (input: StockDocumentInput, files: File[]) => Promise<void>;
  onRemoveAttachment: (attachmentId: string) => Promise<void>;
  onClose: () => void;
};
