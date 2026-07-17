'use client';

import { useEffect, useState } from 'react';
import { Button, ErrorState, Input, LoadingState, Modal } from '@/components/ui';
import type { AdminEntityType, DeletionPreview } from '@/lib/types';
import { adminService } from './admin.service';
import { destructiveErrorMessage, executeDestructiveAction, requiredConfirmation } from './destructive-actions';

export function DestructiveActionModal({ entityType, entityId, onClose, onDeleted }: {
  entityType: AdminEntityType; entityId: string; onClose: () => void; onDeleted: () => Promise<void> | void;
}) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [force, setForce] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    adminService.deletionPreview(entityType, entityId).then(setPreview)
      .catch((reason: unknown) => setError(destructiveErrorMessage(reason)))
      .finally(() => setLoading(false));
  }, [entityId, entityType]);

  async function remove() {
    if (!preview) return;
    setSaving(true); setError('');
    try {
      const submitted = await executeDestructiveAction({ preview, force, confirmation, remove: adminService.deleteEntity, onSuccess: onDeleted });
      if (!submitted) { setError('Введіть точний текст підтвердження.'); return; }
      onClose();
    } catch (reason) {
      setError(destructiveErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return <Modal closeOnEscape={!saving} destructive title="Підтвердження видалення" onClose={onClose}>
    <div className="grid gap-4">
      {loading ? <LoadingState label="Завантаження наслідків видалення…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {preview ? <>
        <dl className="grid gap-2 text-sm"><div><dt className="font-semibold">Сутність</dt><dd>{preview.displayName}</dd></div><div><dt className="font-semibold">ID</dt><dd className="break-all font-mono">{preview.entityId}</dd></div></dl>
        <div><p className="font-semibold">Залежності</p>{preview.dependencies.length ? <ul className="mt-2 grid gap-1 text-sm">{preview.dependencies.map((item) => <li key={`${item.type}-${item.action}`}>{item.type}: {item.count} — {item.action}</li>)}</ul> : <p className="text-sm text-[var(--color-text-secondary)]">Пов’язаних записів немає.</p>}</div>
        {preview.blockers.length ? <div className="rounded border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger)]"><p className="font-semibold">Операцію блокують:</p><ul className="mt-1 list-disc pl-5">{preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
        {entityType === 'imports' && preview.blockers.some((item) => /rollback|відкот/i.test(item)) ? <p className="text-sm font-semibold text-[var(--color-warning)]">Перед видаленням потрібен rollback імпорту.</p> : null}
        <label className="flex items-center gap-2 text-sm"><input checked={force} type="checkbox" onChange={(event) => { setForce(event.target.checked); setConfirmation(''); }} />Force-delete тестових даних</label>
        <label className="grid gap-1 text-sm font-medium">Введіть «{requiredConfirmation(preview, force)}»<Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <div className="flex justify-end gap-2"><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button variant="danger" disabled={saving} type="button" onClick={() => void remove()}>{saving ? 'Видалення…' : 'Видалити'}</Button></div>
      </> : null}
    </div>
  </Modal>;
}
