'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage, getMvoErrorMessage } from '@/components/common/formatters';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type {
  AuthUser,
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
import { successfulDocumentActionMessage } from './stock-document-rules';
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
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [confirming, setConfirming] = useState<'post' | 'cancel' | 'remove' | null>(null);
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
  const [success, setSuccess] = useState<{ document: StockDocument; mode: 'draft' | 'post' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await stockDocumentsService.list({
        type: appliedFilters.type || undefined,
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
  }, [appliedFilters, errorMessage, limit, page, user.role]);

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
    if (nextType !== 'ISSUE' && nextType !== 'MVO_TRANSFER') return;
    setActionError(''); setEditing(null); setSelected(null); setSuccess(null);
    const source = user.role === 'MVO' ? (user.responsiblePersonId ?? '') : '';
    setFormSourceId(source); setFormType(nextType);
    void loadSources(source);
    if (nextType === 'MVO_TRANSFER') void loadTargets();
  }

  async function openDetails(document: StockDocument) {
    setActionError(''); setConfirming(null); setSuccess(null);
    try { setSelected(await stockDocumentsService.findOne(document.id)); }
    catch (reason) { setError(errorMessage(reason)); }
  }

  async function openEdit(document: StockDocument) {
    if (
      (document.type !== 'ISSUE' && document.type !== 'MVO_TRANSFER') ||
      document.lines.some((line) => !line.sourceBalanceId)
    ) {
      return;
    }
    setSelected(null); setEditing(document); setFormSourceId(document.sourceResponsiblePersonId);
    setFormType(document.type); setActionError('');
    await loadSources(document.sourceResponsiblePersonId);
    if (document.type === 'MVO_TRANSFER') await loadTargets();
  }

  async function save(input: StockDocumentInput, files: File[]) {
    setSaving(true); setActionError('');
    let savedDocument: StockDocument | null = null;
    try {
      let result = editing
        ? await stockDocumentsService.update(editing.id, input)
        : await stockDocumentsService.create(input);
      savedDocument = result;
      if (!editing) setEditing(result);
      for (const file of files) {
        await stockDocumentsService.uploadAttachment(result.id, file);
        result = await stockDocumentsService.findOne(result.id);
        savedDocument = result;
        setEditing(result);
      }
      setFormType(null); setEditing(null); setSelected(result);
      setSuccess({ document: result, mode: 'draft' });
      await load();
    } catch (reason) {
      setActionError(errorMessage(reason));
      if (savedDocument) {
        try {
          setEditing(await stockDocumentsService.findOne(savedDocument.id));
        } catch {
          setEditing(savedDocument);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!editing) return;
    setSaving(true); setActionError('');
    try {
      await stockDocumentsService.removeAttachment(editing.id, attachmentId);
      setEditing(await stockDocumentsService.findOne(editing.id));
    } catch (reason) {
      setActionError(errorMessage(reason));
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
        if (action === 'post') setSuccess({ document: result, mode: 'post' });
        else setToast(successfulDocumentActionMessage(result, action));
      }
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

  function openConfirmation(action: 'post' | 'cancel' | 'remove', document: StockDocument) {
    setSelected(document); setActionError(''); setConfirming(action);
  }

  function closeConfirmation() {
    setConfirming(null); setActionError('');
  }

  return {
    documents: filteredDocuments, persons, transferTargets, availableSources, pagination,
    page, setPage, limit, setLimit, draftFilters, setDraftFilters, appliedFilters, setAppliedFilters,
    selected, setSelected, formType, setFormType, formSourceId, editing,
    confirming, setConfirming, loading, loadingSources, loadingTargets, saving,
    actionLoading, error, personsError, sourcesError, targetsError, actionError, toast, setToast, success, setSuccess,
    load, loadReferences, loadSources, loadTargets, openCreate, openDetails, openEdit, save, removeAttachment, perform,
    openConfirmation, closeConfirmation,
  };
}
