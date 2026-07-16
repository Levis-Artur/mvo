'use client';

import { ErrorMessage, Modal, StatusPill } from '@/components/common';
import { formatDateTime, fullName } from '@/components/common/formatters';
import type { AuthUser, StockDocument } from '@/lib/types';
import { lifecycleActions } from './stock-document-rules';

export function StockDocumentDetailsModal({ document, user, loading, error, onEdit, onPost, onCancel, onDelete, onClose }: {
  document: StockDocument; user: AuthUser; loading: boolean; error: string;
  onEdit: () => void; onPost: () => void; onCancel: () => void; onDelete: () => void; onClose: () => void;
}) {
  const actions = lifecycleActions(document, user);
  return <Modal title={`Документ № ${document.documentNumber}`} onClose={onClose}>
    <div className="grid gap-3 text-sm">
      <div className="grid gap-2 rounded border border-[var(--border)] p-3 sm:grid-cols-2">
        <p><b>Дата:</b> {formatDateTime(document.documentDate)}</p><p><b>Статус:</b> <StatusPill status={document.status} /></p>
        <p><b>Тип:</b> {document.type === 'TRANSFER' ? 'Передача' : 'Видача'}</p><p><b>Автор:</b> {document.createdByUser.username}</p>
        <p><b>Відправник:</b> {fullName(document.sourceResponsiblePerson)}</p>
        <p><b>Одержувач:</b> {document.destinationResponsiblePerson ? fullName(document.destinationResponsiblePerson) : document.recipientName ?? '—'}</p>
        <p><b>Підстава:</b> {document.basis ?? '—'}</p><p><b>Примітка:</b> {document.note ?? '—'}</p>
        {document.cancelledAt ? <p><b>Скасовано:</b> {formatDateTime(document.cancelledAt)} · {document.cancelledByUser?.username}</p> : null}
      </div>
      <div className="compact-scrollbar overflow-auto"><table className="data-table"><thead><tr><th>Код</th><th>Номенклатура</th><th>Од.</th><th>Кількість</th><th>Примітка</th></tr></thead><tbody>{document.lines.map((line) => <tr key={line.id}><td>{line.inventoryItem.externalCode}</td><td>{line.inventoryItem.name}</td><td>{line.inventoryItem.unitOfMeasure ?? '—'}</td><td>{line.quantity}</td><td>{line.note ?? '—'}</td></tr>)}</tbody></table></div>
      {error ? <ErrorMessage message={error} /> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {actions.edit ? <button className="btn btn-outline !w-auto" disabled={loading} type="button" onClick={onEdit}>Редагувати</button> : null}
        {actions.post ? <button className="btn btn-primary !w-auto" disabled={loading} type="button" onClick={onPost}>Провести</button> : null}
        {actions.cancel ? <button className="btn btn-danger !w-auto" disabled={loading} type="button" onClick={onCancel}>Скасувати документ</button> : null}
        {actions.remove ? <button className="btn btn-danger !w-auto" disabled={loading} type="button" onClick={onDelete}>Видалити чернетку</button> : null}
        <button className="btn btn-outline !w-auto" type="button" onClick={onClose}>Закрити</button>
      </div>
    </div>
  </Modal>;
}
