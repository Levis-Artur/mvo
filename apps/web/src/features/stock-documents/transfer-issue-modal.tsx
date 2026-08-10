'use client';

import { useMemo, useState } from 'react';
import { getMvoErrorMessage } from '@/components/common';
import type {
  AuthUser,
  AvailableStockSource,
  StockDocument,
  StockDocumentInput,
} from '@/lib/types';
import { submitNewIssue } from './issue-submit';
import { StockDocumentForm } from './stock-document-form';
import { stockDocumentsService } from './stock-documents.service';

export function TransferIssueModal({
  user,
  transfer,
  initialTransferLineId,
  onClose,
  onSuccess,
}: {
  user: AuthUser;
  transfer: StockDocument;
  initialTransferLineId?: string;
  onClose: () => void;
  onSuccess: (issue: StockDocument) => Promise<void> | void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sources = useMemo<AvailableStockSource[]>(
    () =>
      transfer.lines
        .filter((line) => Number(line.availableToIssue ?? '0') > 0)
        .map((line) => ({
          inventoryItem: line.inventoryItem,
          balanceId: line.id,
          sourceTransferLineId: line.id,
          availableQuantity: line.availableToIssue ?? '0',
          unit: line.inventoryItem.unitOfMeasure,
          canTransfer: false,
          canIssue: true,
        })),
    [transfer],
  );

  async function submit(input: StockDocumentInput, files: File[]) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const issue = await submitNewIssue(
        transfer.id,
        input,
        files,
        stockDocumentsService.createTransferIssue,
      );
      await onSuccess(issue);
    } catch (reason) {
      setError(getMvoErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <StockDocumentForm
      availableSources={sources}
      document={null}
      error={error}
      initialIssueLineId={initialTransferLineId}
      initialSourceId={transfer.sourceResponsiblePersonId}
      loadingSources={false}
      loadingTargets={false}
      persons={[]}
      saving={saving}
      sourceTransfer={transfer}
      sourcesError=""
      targetsError=""
      transferTargets={[]}
      type="ISSUE"
      user={user}
      onClose={onClose}
      onRemoveAttachment={async () => undefined}
      onSourceChange={() => undefined}
      onSubmit={submit}
    />
  );
}
