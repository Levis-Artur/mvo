'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, ErrorState, FormField, Input, LoadingState, Modal } from '@/components/ui';
import type { AdminEntityType, DeletionPreview } from '@/lib/types';
import { adminService } from './admin.service';
import { destructiveErrorMessage, executeDestructiveAction, requiredConfirmation } from './destructive-actions';

const actionLabels = { BLOCK: 'блокує видалення', DELETE: 'буде видалено', DETACH: 'буде від’єднано', RETAIN: 'буде збережено' } as const;

export function DestructiveActionModal({ entityType, entityId, onClose, onDeleted }: { entityType: AdminEntityType; entityId: string; onClose: () => void; onDeleted: () => Promise<void> | void }) {
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [force, setForce] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { adminService.deletionPreview(entityType, entityId).then(setPreview).catch((reason: unknown) => setError(destructiveErrorMessage(reason))).finally(() => setLoading(false)); }, [entityId, entityType]);

  async function remove() {
    if (!preview) return;
    setSaving(true); setError('');
    try {
      const submitted = await executeDestructiveAction({ preview, force, confirmation, remove: adminService.deleteEntity, onSuccess: onDeleted });
      if (!submitted) { setError('Введіть точний текст підтвердження.'); return; }
      onClose();
    } catch (reason) { setError(destructiveErrorMessage(reason)); }
    finally { setSaving(false); }
  }

  const footer = preview ? <><Button variant="outline" type="button" onClick={onClose}>Скасувати</Button><Button disabled={saving || !preview.canDelete} variant="danger" type="button" onClick={() => void remove()}>{saving ? 'Видалення…' : 'Видалити'}</Button></> : undefined;
  return <Modal closeOnEscape={!saving} destructive footer={footer} title="Підтвердження видалення" onClose={onClose}><div className="grid gap-4">
    {loading ? <LoadingState label="Завантаження наслідків видалення…" /> : null}
    {error ? <ErrorState message={error} /> : null}
    {preview ? <><dl className="detail-list"><div><dt>Сутність</dt><dd>{preview.displayName}</dd></div><div><dt>ID</dt><dd className="font-mono">{preview.entityId}</dd></div></dl>
      <section><h3 className="font-semibold">Залежності</h3>{preview.dependencies.length ? <ul className="mt-2 grid gap-1 text-sm">{preview.dependencies.map((item) => <li key={`${item.type}-${item.action}`}>{item.type}: <strong>{item.count}</strong> — {actionLabels[item.action]}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-text-secondary)]">Пов’язаних записів немає.</p>}</section>
      {preview.blockers.length ? <div className="ui-alert" data-tone="danger"><strong>Операцію блокують:</strong><ul className="list-disc pl-5">{preview.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div> : null}
      {entityType === 'imports' && preview.blockers.some((item) => /rollback|відкот/i.test(item)) ? <div className="ui-alert" data-tone="warning">Перед видаленням потрібно відкотити імпорт.</div> : null}
      <Checkbox checked={force} label="Примусове видалення тестових даних" onChange={(event) => { setForce(event.target.checked); setConfirmation(''); }} />
      <FormField label={`Введіть «${requiredConfirmation(preview, force)}»`} required><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></FormField></> : null}
  </div></Modal>;
}
