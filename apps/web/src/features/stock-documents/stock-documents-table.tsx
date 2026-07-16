'use client';

import { StatusPill } from '@/components/common';
import { formatDateTime, fullName } from '@/components/common/formatters';
import type { AuthUser, StockDocument } from '@/lib/types';
import { documentDirection } from './stock-document-rules';

const statusLabels = { DRAFT: 'Чернетка', POSTED: 'Проведено', CANCELLED: 'Скасовано' };

export function StockDocumentsTable({
  documents,
  user,
  onSelect,
}: {
  documents: StockDocument[];
  user: AuthUser;
  onSelect: (document: StockDocument) => void;
}) {
  if (!documents.length) {
    return <div className="app-card p-6 text-center text-sm text-[var(--text-secondary)]">Документи не знайдено.</div>;
  }
  return (
    <div className="erp-panel overflow-hidden">
      <div className="compact-scrollbar overflow-auto">
        <table className="data-table">
          <thead><tr><th>Номер</th><th>Дата</th><th>Тип</th><th>Статус</th><th>Відправник</th><th>Одержувач</th><th>Позицій</th><th>Кількість</th><th>Автор</th><th>Проведено</th></tr></thead>
          <tbody>
            {documents.map((document) => (
              <tr className="cursor-pointer" key={document.id} onClick={() => onSelect(document)}>
                <td>{document.documentNumber}</td>
                <td>{formatDateTime(document.documentDate)}</td>
                <td><span className="rounded border border-[var(--border)] px-2 py-1 text-xs">{documentDirection(document, user)}</span></td>
                <td><StatusPill status={statusLabels[document.status]} /></td>
                <td>{fullName(document.sourceResponsiblePerson)}</td>
                <td>{document.destinationResponsiblePerson ? fullName(document.destinationResponsiblePerson) : document.recipientName ?? '—'}</td>
                <td>{document.totalPositions}</td><td>{document.totalQuantity}</td>
                <td>{document.createdByUser.username}</td><td>{document.postedAt ? formatDateTime(document.postedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
