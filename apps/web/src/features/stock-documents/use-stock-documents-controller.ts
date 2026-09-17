'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage, getMvoErrorMessage } from '@/components/common/formatters';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type {
  AuthUser,
  ReadAccessMode,
  AvailableStockSource,
  Pagination,
  ResponsiblePerson,
  StockDocument,
  StockDocumentInput,
  StockDocumentStatus,
  StockDocumentType,
  TransferTarget,
} from '@/lib/types';
import { stockDocumentsService } from './stock-documents.service';
import { shouldLoadGlobalResponsiblePersons } from './stock-document-loading-policy';
import { documentCancellationMessage } from './stock-document-rules';
import { loadTransferTargets } from './transfer-targets';
import { submitNewMvoTransfer } from './mvo-transfer-submit';

export type DocumentFilters = {
  search: string;
  type: '' | StockDocumentType;
  status: '' | StockDocumentStatus;
  sourceId: string;
  destinationId: string;
  dateFrom: string;
  dateTo: string;
};

export const DEFAULT_DOCUMENT_FILTERS: DocumentFilters = {
  search: '', type: '', status: '', sourceId: '', destinationId: '', dateFrom: '', dateTo: '',
};
const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

export function useStockDocumentsController(user: AuthUser, accessMode?: ReadAccessMode) {
  const errorMessage = user.role === 'MVO' ? getMvoErrorMessage : getErrorMessage;
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [availableSources, setAvailableSources] = useState<AvailableStockSource[]>([]);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [selected, setSelected] = useState<StockDocument | null>(null);
  const [formType, setFormType] = useState<StockDocumentType | null>(null);
  const [formSourceId, setFormSourceId] = useState('');
  const [confirming, setConfirming] = useState<'cancel' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [personsError, setPersonsError] = useState('');
  const [sourcesError, setSourcesError] = useState('');
  const [targetsError, setTargetsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await stockDocumentsService.list({
        accessMode,
        type: user.role === 'MVO' ? 'MVO_TRANSFER' : appliedFilters.type || undefined,
        status: appliedFilters.status || undefined,
        sourceResponsiblePersonId: user.role === 'MVO' ? undefined : appliedFilters.sourceId || undefined,
        destinationResponsiblePersonId: user.role === 'MVO' ? undefined : appliedFilters.destinationId || undefined,
        documentDateFrom: appliedFilters.dateFrom ? new Date(`${appliedFilters.dateFrom}T00:00:00.000Z`).toISOString() : undefined,
        documentDateTo: appliedFilters.dateTo ? new Date(`${appliedFilters.dateTo}T23:59:59.999Z`).toISOString() : undefined,
        page,
        limit: Math.min(limit, 100),
      });
      setDocuments(response.items); setPagination(response.pagination);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, errorMessage, limit, page, user.role, accessMode]);

  const loadReferences = useCallback(async () => {
    setPersonsError('');
    if (!shouldLoadGlobalResponsiblePersons(user.role)) {
      setPersons([]);
      return;
    }
    try {
      setPersons(await fetchAllPages((pagination) =>
        stockDocumentsService.persons({ ...pagination, isActive: true }),
      ));
    } catch (reason) {
      setPersonsError(`Не вдалося завантажити список МВО: ${errorMessage(reason)}`);
    }
  }, [errorMessage, user.role]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadReferences(); }, [loadReferences]);

  const filteredDocuments = useMemo(() => {
    const needle = appliedFilters.search.trim().toLocaleLowerCase('uk-UA');
    if (!needle) return documents;
    return documents.filter((document) =>
      [String(document.displayNumber), document.recipientName, document.recipientUnit,
        document.sourceResponsiblePerson.lastName, document.destinationResponsiblePerson?.lastName]
        .filter(Boolean).some((value) => value!.toLocaleLowerCase('uk-UA').includes(needle)),
    );
  }, [appliedFilters.search, documents]);

  async function loadSources(id: string) {
    setAvailableSources([]); setSourcesError('');
    if (!id) return;
    setLoadingSources(true);
    try {
      if (user.role === 'MVO') {
        setAvailableSources(await stockDocumentsService.availableToMe());
      } else {
        const card = await stockDocumentsService.personAccountingCard(id);
        setAvailableSources(card.directBalances.map((balance) => ({
          inventoryItem: balance.inventoryItem,
          balanceId: balance.id,
          availableQuantity: balance.quantity,
          unit: balance.inventoryItem.unitOfMeasure,
          canTransfer: true,
          canIssue: true,
        })));
      }
    } catch (reason) {
      setSourcesError(`Не вдалося завантажити доступне майно: ${errorMessage(reason)}`);
    } finally {
      setLoadingSources(false);
    }
  }

  async function loadTargets() {
    setTargetsError('');
    setLoadingTargets(true);
    try {
      setTransferTargets(await loadTransferTargets(stockDocumentsService.transferTargets));
    } catch (reason) {
      setTargetsError(`Не вдалося завантажити МВО-одержувачів: ${errorMessage(reason)}`);
    } finally {
      setLoadingTargets(false);
    }
  }

  function openCreate(nextType: StockDocumentType) {
    if (nextType !== 'MVO_TRANSFER') return;
    setActionError(''); setSelected(null);
    const source = user.role === 'MVO' ? (user.responsiblePersonId ?? '') : '';
    setFormSourceId(source); setFormType(nextType);
    void loadSources(source);
    if (nextType === 'MVO_TRANSFER') void loadTargets();
  }

  async function openDetails(document: Pick<StockDocument, 'id'>) {
    setActionError(''); setConfirming(null);
    try { setSelected(await stockDocumentsService.findOne(document.id, accessMode)); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  async function save(input: StockDocumentInput) {
    if (input.type !== 'MVO_TRANSFER') return;
    setSaving(true); setActionError('');
    try {
      await submitNewMvoTransfer(input, stockDocumentsService.createAndPostMvoTransfer);
      setFormType(null);
      setSelected(null);
      setToast('Передачу проведено. Залишки оновлено.');
      await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-accounting-cards'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock-documents'));
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function perform(reason?: string) {
    if (!selected) return;
    setActionLoading(true); setActionError('');
    try {
      const result = reason === undefined
        ? await stockDocumentsService.cancel(selected.id)
        : await stockDocumentsService.cancel(selected.id, reason);
      setSelected(result);
      setToast(documentCancellationMessage(result));
      setConfirming(null);
      await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-accounting-cards'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock-documents'));
    } catch (reason) {
      setActionError(errorMessage(reason));
    } finally {
      setActionLoading(false);
    }
  }

  function openConfirmation(document: StockDocument) {
    setSelected(document); setActionError(''); setConfirming('cancel');
  }

  function closeConfirmation() {
    setConfirming(null); setActionError('');
  }

  function closeForm() {
    setFormType(null);
    setActionError('');
  }

  return {
    documents: filteredDocuments, persons, transferTargets, availableSources, pagination,
    page, setPage, limit, setLimit, draftFilters, setDraftFilters, appliedFilters, setAppliedFilters,
    selected, setSelected, formType, setFormType, formSourceId,
    confirming, setConfirming, loading, loadingSources, loadingTargets, saving,
    actionLoading, error, personsError, sourcesError, targetsError, actionError, toast, setToast,
    load, loadReferences, loadSources, loadTargets, openCreate, openDetails, save, perform,
    openConfirmation, closeConfirmation, closeForm,
  };
}
