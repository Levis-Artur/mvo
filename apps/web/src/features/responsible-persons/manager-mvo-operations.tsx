'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getErrorMessage } from '@/components/common';
import { Button, Toast } from '@/components/ui';
import { apiClient } from '@/lib/api-client';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { AvailableStockSource, ResponsiblePerson, StockDocumentInput, StockDocumentType, TransferTarget } from '@/lib/types';
import { StockDocumentForm } from '@/features/stock-documents/stock-document-form';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
import { submitNewIssue } from '@/features/stock-documents/issue-submit';
import { submitNewMvoTransfer } from '@/features/stock-documents/mvo-transfer-submit';
import { personDisplayName } from './persons-model';

export function ManagerMvoOperations({ person, onCompleted }: { person: ResponsiblePerson; onCompleted: () => void }) {
  const { user } = useAuth();
  const [type, setType] = useState<StockDocumentType | null>(null);
  const [sources, setSources] = useState<AvailableStockSource[]>([]);
  const [targets, setTargets] = useState<TransferTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!type) return;
    let active = true;
    setLoading(true);
    setLoadError('');
    setError('');
    setSources([]);
    setTargets([]);
    Promise.all([
      apiClient.availableStockToMe(person.id),
      type === 'MVO_TRANSFER' ? fetchAllPages((pagination) => apiClient.transferTargets({ isActive: true, ...pagination })) : Promise.resolve([]),
    ]).then(([stock, recipients]) => {
      if (active) { setSources(stock); setTargets(recipients); }
    }).catch((reason: unknown) => {
      if (active) setLoadError(getErrorMessage(reason));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [person.id, type]);
  if (user?.role !== 'ORG_MANAGER' || !person.isActive) return null;
  async function submit(input: StockDocumentInput, files: File[]) {
    if (saving || loading || loadError) return;
    setSaving(true);
    setError('');
    try {
      if (input.type === 'MVO_TRANSFER') {
        await submitNewMvoTransfer(input, (body) => stockDocumentsService.createAndPostMvoTransfer({ ...body, targetResponsiblePersonId: person.id }));
      } else {
        await submitNewIssue(input, files, (body, attachments) => stockDocumentsService.createAndPostIssue({ ...body, targetResponsiblePersonId: person.id }, attachments));
      }
      setType(null);
      setToast('Операцію проведено.');
      onCompleted();
    } catch (reason: unknown) { setError(getErrorMessage(reason)); }
    finally { setSaving(false); }
  }
  return <>
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => setType('MVO_TRANSFER')}>Передати</Button>
      <Button type="button" onClick={() => setType('ISSUE')}>Видати</Button>
    </div>
    {type ? <StockDocumentForm key={`${person.id}-${type}`} user={user} type={type}
      operationContext={{ responsiblePersonId: person.id, fullName: personDisplayName(person) }}
      initialSourceId={person.id} persons={[person]} transferTargets={targets} availableSources={sources}
      loadingSources={loading} loadingTargets={loading} saving={saving} error={error}
      sourcesError={loadError} targetsError={loadError} onSubmit={submit}
      onSourceChange={async () => {
        setLoadError(''); setLoading(true);
        try { setSources(await apiClient.availableStockToMe(person.id)); }
        catch (reason: unknown) { setLoadError(getErrorMessage(reason)); }
        finally { setLoading(false); }
      }}
      onClose={() => { if (!saving) setType(null); }} /> : null}
    {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}
  </>;
}
