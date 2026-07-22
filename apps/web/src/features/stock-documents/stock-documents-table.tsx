import type { AuthUser, StockDocument } from '@/lib/types';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import {
  documentDirectionPresentation,
  documentCounterparty,
  documentNumberLabel,
  documentTypeLabel,
  documentVolumePresentation,
  lifecycleActions,
} from './stock-document-rules';
import { StockDocumentStatusBadge } from './stock-document-status-badge';

export function StockDocumentsTable({ documents, user, loading, onView, onEdit, onPost, onCancel, onRemove }: {
  documents: StockDocument[];
  user: AuthUser;
  loading: boolean;
  onView: (document: StockDocument) => void;
  onEdit: (document: StockDocument) => void;
  onPost: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
  onRemove: (document: StockDocument) => void;
}) {
  if (user.role === 'MVO') {
    return <DataTable
      ariaLabel="Мої передачі та видачі"
      columns={[
        { label: 'Дата', className: 'stock-documents-table__date' },
        { label: 'Документ', className: 'stock-documents-table__document' },
        { label: 'Кому / від кого', className: 'stock-documents-table__person' },
        { label: 'Обсяг', className: 'stock-documents-table__volume' },
        { label: 'Статус', className: 'stock-documents-table__status' },
        { label: 'Дії', actions: true, className: 'stock-documents-table__actions' },
      ]}
      emptyMessage="Передач і видач поки немає."
      loading={loading}
      tableClassName="stock-documents-table stock-documents-table--mvo"
      rows={documents.map((document) => {
        const actions = lifecycleActions(document, user);
        const counterparty = documentCounterparty(document, user);
        const volume = documentVolumePresentation(document.totalPositions, document.totalQuantity);
        return [
          new Date(document.documentDate).toLocaleDateString('uk-UA'),
          <div className="stock-document-summary" key="document"><StatusBadge tone={document.type === 'ISSUE' ? 'warning' : document.type === 'MVO_TRANSFER' ? 'info' : 'neutral'}>{documentTypeLabel(document.type)}</StatusBadge><Button size="compact" title={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} variant="link" type="button" onClick={() => onView(document)}>{documentNumberLabel(document.displayNumber)}</Button></div>,
          <span className="stock-documents-table__person-text" key="counterparty" title={counterparty}>{counterparty}</span>,
          <span aria-label={volume.full} className="stock-documents-table__volume-text" key="volume" title={volume.full}>{volume.compact}</span>,
          <StockDocumentStatusBadge key="status" status={document.status} />,
          <MvoDocumentActions key="actions" actions={actions} document={document} onView={onView} onCancel={onCancel} />,
        ];
      })}
    />;
  }
  return <DataTable
    ariaLabel="Список документів передачі та видачі"
    columns={[
      { label: 'Номер', className: 'stock-documents-table__number' }, { label: 'Дата', className: 'stock-documents-table__date' }, { label: 'Тип' }, { label: 'Статус' },
      { label: 'Відправник' }, { label: 'Одержувач' }, { label: 'Позицій', numeric: true },
      { label: 'Загальна кількість', numeric: true }, { label: 'Автор' },
      { label: 'Проведення' }, { label: 'Дії', actions: true, className: 'stock-documents-table__actions' },
    ]}
    emptyMessage="Документи за вказаними фільтрами не знайдено."
    loading={loading}
    rows={documents.map((document) => {
      const direction = documentDirectionPresentation(document);
      const actions = lifecycleActions(document, user);
      const recipient = document.destinationResponsiblePerson
        ? fullName(document.destinationResponsiblePerson)
        : document.recipientName ?? '—';
      return [
        <Button key="number" size="compact" title={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} variant="link" type="button" onClick={() => onView(document)}>{documentNumberLabel(document.displayNumber)}</Button>,
        new Date(document.documentDate).toLocaleDateString('uk-UA'),
        <StatusBadge key="direction" tone={direction.tone}>{direction.label}</StatusBadge>,
        <StockDocumentStatusBadge key="status" status={document.status} />,
        <span className="block max-w-52 break-words" key="source">{fullName(document.sourceResponsiblePerson)}</span>,
        <span className="block max-w-52 break-words" key="recipient">{recipient}</span>,
        document.totalPositions,
        formatQuantity(document.totalQuantity),
        document.createdByUser.username,
        document.postedAt
          ? <span key="posted">{formatDateTime(document.postedAt)} · {document.postedByUser?.username ?? '—'}</span>
          : '—',
        <DocumentActions key="actions" actions={actions} document={document} onView={onView} onEdit={onEdit} onPost={onPost} onCancel={onCancel} onRemove={onRemove} />,
      ];
    })}
  />;
}

function MvoDocumentActions({ actions, document, onView, onCancel }: {
  actions: ReturnType<typeof lifecycleActions>;
  document: StockDocument;
  onView: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
}) {
  return <div className="stock-document-actions stock-document-actions--mvo">
    <Button aria-label={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} size="compact" title="Переглянути документ" variant="outline" type="button" onClick={() => onView(document)}>Переглянути</Button>
    {actions.cancel ? <Button size="compact" title="Скасувати документ" variant="danger" type="button" onClick={() => onCancel(document)}>Скасувати</Button> : null}
  </div>;
}

function DocumentActions({ actions, document, onView, onEdit, onPost, onCancel, onRemove }: {
  actions: ReturnType<typeof lifecycleActions>;
  document: StockDocument;
  onView: (document: StockDocument) => void;
  onEdit: (document: StockDocument) => void;
  onPost: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
  onRemove: (document: StockDocument) => void;
}) {
  return <div className="stock-document-actions">
    <Button aria-label={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} size="compact" title="Переглянути документ" variant="outline" type="button" onClick={() => onView(document)}>Переглянути</Button>
    {actions.edit ? <Button size="compact" title="Редагувати чернетку" variant="outline" type="button" onClick={() => onEdit(document)}>Редагувати</Button> : null}
    {actions.post ? <Button size="compact" title="Провести документ" type="button" onClick={() => onPost(document)}>Провести</Button> : null}
    {actions.cancel ? <Button size="compact" title="Скасувати документ" variant="danger" type="button" onClick={() => onCancel(document)}>Скасувати</Button> : null}
    {actions.remove ? <Button size="compact" title="Видалити чернетку" variant="danger" type="button" onClick={() => onRemove(document)}>Видалити</Button> : null}
  </div>;
}
