'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getErrorMessage } from '@/components/common';
import { ErrorState, LoadingState, Modal, Toast } from '@/components/ui';
import type { ResponsiblePerson, StockDocument } from '@/lib/types';
import { personDisplayName } from '@/features/responsible-persons/persons-model';
import { IssueRealizationFormModal } from './issue-realization-form-modal';
import { MvoIssueDetailsModal } from './mvo-issue-details-modal';
import { StockDocumentDetailsModal } from './stock-document-details-modal';
import { stockDocumentsService } from './stock-documents.service';
import { CancelDocumentModal } from './cancel-document-modal';
import { managerCancellationAllowed } from './stock-document-rules';

export function ReadOnlyDocumentDetails({ documentId, onClose, operationTarget, onCompleted }: {
  documentId: string; onClose: () => void;
  operationTarget?: ResponsiblePerson; onCompleted?: () => void;
}) {
  const { user } = useAuth();
  const [document, setDocument] = useState<StockDocument | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [realizing, setRealizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState('');
  const [toast, setToast] = useState('');
  const accessMode = user?.role === 'ORG_MANAGER' || user?.role === 'MVO' ? 'SCOPED_READ' : undefined;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDocument(null);
    stockDocumentsService.findOne(documentId, accessMode).then((result) => {
      if (active) setDocument(result);
    }).catch((reason: unknown) => {
      if (active) setError(getErrorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [documentId, accessMode, revision]);
  if (loading || error || !document || !user) return <Modal title="Перегляд документа" onClose={onClose}>
    {error ? <ErrorState message={error} /> : <LoadingState />}
  </Modal>;
  const canRealize = (user.role === 'ORG_MANAGER' || user.role === 'OWNER') && operationTarget?.isActive === true
    && document.sourceResponsiblePersonId === operationTarget.id;
  const canCancel = managerCancellationAllowed(document, user);
  if (cancelling && canCancel) return <CancelDocumentModal
    document={document} requireReason error={operationError} loading={saving}
    onClose={() => { if (!saving) setCancelling(false); }}
    onConfirm={async (reason) => {
      if (saving) return;
      setSaving(true); setOperationError('');
      try {
        await stockDocumentsService.cancel(document.id, reason);
        setCancelling(false); setRevision((value) => value + 1);
        setToast('Операцію скасовано.'); onCompleted?.();
        for (const event of ['stock', 'transactions', 'accounting-cards', 'stock-documents']) {
          window.dispatchEvent(new CustomEvent(`mvo:refresh-${event}`));
        }
      } catch (error: unknown) { setOperationError(getErrorMessage(error)); }
      finally { setSaving(false); }
    }} />;
  if (realizing && canRealize && operationTarget) return <IssueRealizationFormModal
    issue={document} operationContextName={personDisplayName(operationTarget)} error={operationError} saving={saving}
    onClose={() => { if (!saving) setRealizing(false); }}
    onSubmit={async (input, files) => {
      if (saving) return;
      setSaving(true); setOperationError('');
      try {
        await stockDocumentsService.createIssueRealization(document.id, { ...input, targetResponsiblePersonId: operationTarget.id }, files);
        setRealizing(false); setRevision((value) => value + 1); setToast('Реалізацію проведено.'); onCompleted?.();
      } catch (reason: unknown) { setOperationError(getErrorMessage(reason)); }
      finally { setSaving(false); }
    }} />;
  if (document.type === 'ISSUE') return <><MvoIssueDetailsModal
    document={document} error="" loading={false} readOnly onClose={onClose}
    canCreateRealization={canRealize}
    canManagerCancel={canCancel}
    onCancel={() => { setOperationError(''); setCancelling(true); }} onCancelRealization={() => {}} onRealize={() => { setOperationError(''); setRealizing(true); }}
  />{toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}</>;
  return <><StockDocumentDetailsModal document={document} user={user} error="" loading={false}
    readOnly canManagerCancel={canCancel} onClose={onClose}
    onCancel={() => { setOperationError(''); setCancelling(true); }} />
    {toast ? <Toast message={toast} onClose={() => setToast('')} /> : null}</>;
}
