import type { AuthUser, StockDocument } from '@/lib/types';
import { formatDateTime, fullName } from '@/components/common/formatters';
import { Button, DataTable, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import {
  documentDirectionPresentation,
  documentCounterparty,
  documentNumberLabel,
  lifecycleActions,
} from './stock-document-rules';
import { StockDocumentStatusBadge } from './stock-document-status-badge';

export function StockDocumentsTable({ documents, user, loading, onView, onCancel }: {
  documents: StockDocument[];
  user: AuthUser;
  loading: boolean;
  onView: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
}) {
  const showUnrealized = documents.some((document) => document.type === 'ISSUE');
  if (user.role === 'MVO' || user.role === 'ORG_MANAGER') {
    return <DataTable
      ariaLabel={user.role === 'MVO' ? 'Мої передачі' : 'Передачі та видачі МВО'}
      columns={[
        { label: '№', className: 'stock-documents-table__number' },
        { label: 'Дата', className: 'stock-documents-table__date' },
        ...(user.role === 'ORG_MANAGER' ? [{ label: 'Тип' }, { label: 'Відправник' }] : []),
        { label: 'Кому / від кого', className: 'stock-documents-table__person' },
        { label: 'Номенклатура' },
        { label: 'Кількість', numeric: true },
        ...(showUnrealized ? [{ label: 'Не реалізовано', numeric: true }] : []),
        { label: 'Статус', className: 'stock-documents-table__status' },
        ...(user.role === 'ORG_MANAGER' ? [{ label: 'Документ' }] : []),
        { label: 'Дії', actions: true, className: 'stock-documents-table__actions' },
      ]}
      emptyMessage="Передач поки немає."
      loading={loading}
      responsiveMode="cards-wide"
      tableClassName="stock-documents-table stock-documents-table--mvo"
      rows={documents.map((document) => {
        const actions = lifecycleActions(document, user);
        const counterparty = documentCounterparty(document, user);
        return [
          <Button key="number" size="compact" title={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} variant="link" type="button" onClick={() => onView(document)}>{documentNumberLabel(document.displayNumber)}</Button>,
          new Date(document.documentDate).toLocaleDateString('uk-UA'),
          ...(user.role === 'ORG_MANAGER' ? [
            documentDirectionPresentation(document).label,
            fullName(document.sourceResponsiblePerson),
          ] : []),
          <span className="stock-documents-table__person-text" key="counterparty" title={counterparty}>{counterparty}</span>,
          <span key="items" className="block break-words whitespace-normal">{document.lines.map((line) => line.inventoryItem.name).join(', ')}</span>,
          formatQuantity(document.totalQuantity),
          ...(showUnrealized ? [document.type === 'ISSUE' ? formatQuantity(document.availableToRealize ?? document.totalQuantity) : '—'] : []),
          <StockDocumentStatusBadge key="status" status={document.status} />,
          ...(user.role === 'ORG_MANAGER' ? [document.attachments.length ? <StatusBadge key="attachment" tone="info">Є документ</StatusBadge> : '—'] : []),
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
      ...(showUnrealized ? [{ label: 'Не реалізовано', numeric: true }] : []),
      { label: 'Проведення' }, { label: 'Дії', actions: true, className: 'stock-documents-table__actions' },
    ]}
    emptyMessage="Документи за вказаними фільтрами не знайдено."
    loading={loading}
    responsiveMode="cards-wide"
    scrollMode="horizontal"
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
        ...(showUnrealized ? [document.type === 'ISSUE' ? formatQuantity(document.availableToRealize ?? document.totalQuantity) : '—'] : []),
        document.postedAt
          ? <span key="posted">{formatDateTime(document.postedAt)} · {document.postedByUser?.username ?? '—'}</span>
          : '—',
        <DocumentActions key="actions" actions={actions} document={document} onView={onView} onCancel={onCancel} />,
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
    {isExportedTransfer(document) ? <StatusBadge tone="info">Передано бухгалтерії</StatusBadge> : null}
  </div>;
}

function DocumentActions({ actions, document, onView, onCancel }: {
  actions: ReturnType<typeof lifecycleActions>;
  document: StockDocument;
  onView: (document: StockDocument) => void;
  onCancel: (document: StockDocument) => void;
}) {
  return <div className="stock-document-actions">
    <Button aria-label={`Переглянути документ ${documentNumberLabel(document.displayNumber)}`} size="compact" title="Переглянути документ" variant="outline" type="button" onClick={() => onView(document)}>Переглянути</Button>
    {actions.cancel ? <Button size="compact" title="Скасувати документ" variant="danger" type="button" onClick={() => onCancel(document)}>Скасувати</Button> : null}
    {isExportedTransfer(document) ? <StatusBadge tone="info">Передано бухгалтерії</StatusBadge> : null}
  </div>;
}

function isExportedTransfer(document: StockDocument) {
  return (
    document.type === 'MVO_TRANSFER' &&
    document.accountingExportState === 'EXPORTED'
  );
}
