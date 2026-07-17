'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/components/common/formatters';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type {
  AuthUser,
  Pagination,
  ResponsiblePerson,
  StockBalance,
  StockDocument,
  StockDocumentInput,
  StockDocumentStatus,
  StockDocumentType,
} from '@/lib/types';
import { stockDocumentsService } from './stock-documents.service';
import { loadTransferTargets } from './transfer-targets';

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

export function useStockDocumentsController(user: AuthUser) {
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [transferTargets, setTransferTargets] = useState<ResponsiblePerson[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [selected, setSelected] = useState<StockDocument | null>(null);
  const [formType, setFormType] = useState<StockDocumentType | null>(null);
  const [formSourceId, setFormSourceId] = useState('');
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [confirming, setConfirming] = useState<'post' | 'cancel' | 'remove' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [personsError, setPersonsError] = useState('');
  const [targetsError, setTargetsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await stockDocumentsService.list({
        type: appliedFilters.type || undefined,
        status: appliedFilters.status || undefined,
        sourceResponsiblePersonId: appliedFilters.sourceId || undefined,
        destinationResponsiblePersonId: appliedFilters.destinationId || undefined,
        documentDateFrom: appliedFilters.dateFrom ? new Date(`${appliedFilters.dateFrom}T00:00:00.000Z`).toISOString() : undefined,
        documentDateTo: appliedFilters.dateTo ? new Date(`${appliedFilters.dateTo}T23:59:59.999Z`).toISOString() : undefined,
        page,
        limit: Math.min(limit, 100),
      });
      setDocuments(response.items); setPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, limit, page]);

  const loadReferences = useCallback(async () => {
    setPersonsError(''); setTargetsError(''); setLoadingTargets(true);
    const [sources, targets] = await Promise.allSettled([
      fetchAllPages((pagination) => stockDocumentsService.persons({ ...pagination, isActive: true })),
      loadTransferTargets(stockDocumentsService.transferTargets),
    ]);
    if (sources.status === 'fulfilled') setPersons(sources.value);
    else setPersonsError(`Не вдалося завантажити список МВО: ${getErrorMessage(sources.reason)}`);
    if (targets.status === 'fulfilled') setTransferTargets(targets.value);
    else setTargetsError(`Не вдалося завантажити МВО-одержувачів: ${getErrorMessage(targets.reason)}`);
    setLoadingTargets(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadReferences(); }, [loadReferences]);

  const filteredDocuments = useMemo(() => {
    const needle = appliedFilters.search.trim().toLocaleLowerCase('uk-UA');
    if (!needle) return documents;
    return documents.filter((document) =>
      [document.documentNumber, document.recipientName, document.recipientUnit,
        document.sourceResponsiblePerson.lastName, document.destinationResponsiblePerson?.lastName]
        .filter(Boolean).some((value) => value!.toLocaleLowerCase('uk-UA').includes(needle)),
    );
  }, [appliedFilters.search, documents]);

  async function loadBalances(id: string) {
    setBalances([]); setActionError('');
    if (!id) return;
    setLoadingBalances(true);
    try {
      const items = await fetchAllPages((pagination) => stockDocumentsService.balances({
        ...pagination, responsiblePersonId: id, onlyPositive: true,
      }));
      setBalances(items.filter((item) => Number(item.quantity) > 0));
    } catch (reason) {
      setActionError(`Не вдалося завантажити залишки відправника: ${getErrorMessage(reason)}`);
    } finally {
      setLoadingBalances(false);
    }
  }

  function openCreate(nextType: StockDocumentType, requestedSourceId = '') {
    setActionError(''); setEditing(null); setSelected(null);
    const source = user.role === 'MVO' ? (user.responsiblePersonId ?? '') : requestedSourceId;
    setFormSourceId(source); setFormType(nextType);
    void loadBalances(source);
  }

  async function openDetails(document: StockDocument) {
    setActionError(''); setConfirming(null);
    try { setSelected(await stockDocumentsService.findOne(document.id)); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function openEdit(document: StockDocument) {
    setSelected(null); setEditing(document); setFormSourceId(document.sourceResponsiblePersonId);
    setFormType(document.type); setActionError('');
    await loadBalances(document.sourceResponsiblePersonId);
  }

  async function save(input: StockDocumentInput) {
    setSaving(true); setActionError('');
    try {
      const result = editing
        ? await stockDocumentsService.update(editing.id, input)
        : await stockDocumentsService.create(input);
      setFormType(null); setEditing(null); setSelected(result);
      setToast('Чернетку успішно збережено');
      await load();
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function perform(action: 'post' | 'cancel' | 'remove') {
    if (!selected) return;
    setActionLoading(true); setActionError('');
    try {
      if (action === 'remove') {
        await stockDocumentsService.remove(selected.id);
        setSelected(null); setToast('Чернетку видалено');
      } else {
        const result = await stockDocumentsService[action](selected.id);
        setSelected(result);
        setToast(action === 'post' ? 'Документ успішно проведено' : 'Документ скасовано');
      }
      setConfirming(null);
      await load();
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setActionLoading(false);
    }
  }

  function openConfirmation(action: 'post' | 'cancel' | 'remove', document: StockDocument) {
    setSelected(document); setActionError(''); setConfirming(action);
  }

  function closeConfirmation() {
    setConfirming(null); setActionError('');
  }

  return {
    documents: filteredDocuments, persons, transferTargets, balances, pagination,
    page, setPage, limit, setLimit, draftFilters, setDraftFilters, appliedFilters, setAppliedFilters,
    selected, setSelected, formType, setFormType, formSourceId, editing,
    confirming, setConfirming, loading, loadingBalances, loadingTargets, saving,
    actionLoading, error, personsError, targetsError, actionError, toast, setToast,
    load, loadReferences, loadBalances, openCreate, openDetails, openEdit, save, perform,
    openConfirmation, closeConfirmation,
  };
}
