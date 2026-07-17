import type { AuthUser, StockDocument } from '@/lib/types';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import {
  documentDirectionPresentation,
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
        <button className="font-semibold text-[var(--color-primary)] hover:underline" key="number" type="button" onClick={() => onView(document)}>{document.documentNumber}</button>,
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
        <div className="flex flex-wrap justify-end gap-1" key="actions">
          <Button variant="ghost" type="button" onClick={() => onView(document)}>Переглянути</Button>
          {actions.edit ? <Button variant="ghost" type="button" onClick={() => onEdit(document)}>Редагувати</Button> : null}
          {actions.post ? <Button type="button" onClick={() => onPost(document)}>Провести</Button> : null}
          {actions.cancel ? <Button variant="danger" type="button" onClick={() => onCancel(document)}>Скасувати</Button> : null}
          {actions.remove ? <Button variant="danger" type="button" onClick={() => onRemove(document)}>Видалити</Button> : null}
        </div>,
      ];
    })}
  />;
}
