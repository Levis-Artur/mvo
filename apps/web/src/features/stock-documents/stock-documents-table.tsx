import type { AuthUser, StockDocument } from '@/lib/types';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import {
  documentDirectionPresentation,
  documentCounterparty,
  documentNumberLabel,
  documentTypeLabel,
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
        { label: 'Дата' }, { label: 'Тип' }, { label: 'Номер' },
        { label: 'Кому або від кого', className: 'stock-documents-table__person' },
        { label: 'Позицій', numeric: true }, { label: 'Загальна кількість', numeric: true },
        { label: 'Статус' }, { label: 'Дії', actions: true },
      ]}
      emptyMessage="Передач і видач поки немає."
      loading={loading}
      tableClassName="stock-documents-table stock-documents-table--mvo"
      rows={documents.map((document) => {
        const actions = lifecycleActions(document, user);
        return [
          new Date(document.documentDate).toLocaleDateString('uk-UA'),
          <StatusBadge key="type" tone={document.type === 'ISSUE' ? 'warning' : document.type === 'TRANSFER' ? 'neutral' : 'info'}>{documentTypeLabel(document.type)}</StatusBadge>,
          <Button key="number" variant="link" type="button" onClick={() => onView(document)}>{documentNumberLabel(document.documentNumber, true)}</Button>,
          documentCounterparty(document, user),
          document.totalPositions,
          formatQuantity(document.totalQuantity),
          <StockDocumentStatusBadge key="status" status={document.status} />,
          <DocumentActions key="actions" actions={actions} document={document} onView={onView} onEdit={onEdit} onPost={onPost} onCancel={onCancel} onRemove={onRemove} />,
        ];
      })}
    />;
  }
  return <DataTable
    ariaLabel="Список документів передачі та видачі"
    columns={[
      { label: 'Номер' }, { label: 'Дата' }, { label: 'Тип' }, { label: 'Статус' },
      { label: 'Відправник' }, { label: 'Одержувач' }, { label: 'Позицій', numeric: true },
      { label: 'Загальна кількість', numeric: true }, { label: 'Автор' },
      { label: 'Проведення' }, { label: 'Дії', actions: true },
    ]}
    emptyMessage="Документи за вказаними фільтрами не знайдено."
    loading={loading}
    rows={documents.map((document) => {
      const direction = documentDirectionPresentation(document, user);
      const actions = lifecycleActions(document, user);
      const recipient = document.destinationResponsiblePerson
        ? fullName(document.destinationResponsiblePerson)
        : document.recipientName ?? '—';
      return [
        <Button key="number" variant="link" type="button" onClick={() => onView(document)}>{document.documentNumber}</Button>,
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

function DocumentActions({ actions, document, onView, onEdit, onPost, onCancel, onRemove }: {
  actions: ReturnType<typeof lifecycleActions>;
  document: StockDocument;
  onView: (document: StockDocument) => void;
  onEdit: (document: StockDocument) => void;
  onPost: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
  onRemove: (document: StockDocument) => void;
}) {
  return <div className="flex flex-wrap justify-end gap-1">
    <Button variant="ghost" type="button" onClick={() => onView(document)}>Переглянути</Button>
    {actions.edit ? <Button variant="ghost" type="button" onClick={() => onEdit(document)}>Редагувати</Button> : null}
    {actions.post ? <Button type="button" onClick={() => onPost(document)}>Провести</Button> : null}
    {actions.cancel ? <Button variant="danger" type="button" onClick={() => onCancel(document)}>Скасувати</Button> : null}
    {actions.remove ? <Button variant="danger" type="button" onClick={() => onRemove(document)}>Видалити</Button> : null}
  </div>;
}
