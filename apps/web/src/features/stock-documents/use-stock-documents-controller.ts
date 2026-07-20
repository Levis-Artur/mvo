'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/components/common/formatters';
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
  const [availableSources, setAvailableSources] = useState<AvailableStockSource[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_DOCUMENT_FILTERS);
  const [selected, setSelected] = useState<StockDocument | null>(null);
  const [formType, setFormType] = useState<StockDocumentType | null>(null);
  const [formSourceId, setFormSourceId] = useState('');
  const [initialSourceBalanceId, setInitialSourceBalanceId] = useState('');
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [confirming, setConfirming] = useState<'post' | 'cancel' | 'remove' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
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

  async function loadSources(id: string) {
    setAvailableSources([]); setActionError('');
    if (!id) return;
    setLoadingSources(true);
    try {
      if (user.role === 'MVO') {
        setAvailableSources(await stockDocumentsService.availableToMe());
      } else {
        const [person, card] = await Promise.all([
          stockDocumentsService.person(id),
          stockDocumentsService.personAccountingCard(id),
        ]);
        const holder = {
          id: person.id,
          fullName: [person.lastName, person.firstName, person.middleName].filter(Boolean).join(' '),
          personnelNumber: person.personnelNumber,
        };
        setAvailableSources([
          ...card.directBalances.map((balance) => ({
            sourceKind: 'DIRECT' as const,
            inventoryItem: balance.inventoryItem,
            accountingOwner: holder,
            currentCustodian: holder,
            availableQuantity: balance.quantity,
            sourceBalanceId: balance.id,
            canAssign: true,
            canIssue: true,
          })),
          ...card.assignedToMe.map((balance) => ({
            sourceKind: 'ASSIGNED' as const,
            inventoryItem: balance.inventoryItem,
            accountingOwner: balance.accountingOwner,
            currentCustodian: balance.custodian,
            availableQuantity: balance.quantity,
            sourceBalanceId: balance.id,
            canAssign: true,
            canIssue: true,
          })),
        ]);
      }
    } catch (reason) {
      setActionError(`Не вдалося завантажити майно, доступне фактичному утримувачу: ${getErrorMessage(reason)}`);
    } finally {
      setLoadingSources(false);
    }
  }

  function openCreate(nextType: StockDocumentType, requestedSourceId = '', requestedBalanceId = '') {
    setActionError(''); setEditing(null); setSelected(null);
    const source = user.role === 'MVO' ? (user.responsiblePersonId ?? '') : requestedSourceId;
    setFormSourceId(source); setFormType(nextType);
    setInitialSourceBalanceId(requestedBalanceId);
    void loadSources(source);
  }

  async function openDetails(document: StockDocument) {
    setActionError(''); setConfirming(null);
    try { setSelected(await stockDocumentsService.findOne(document.id)); }
    catch (reason) { setError(getErrorMessage(reason)); }
  }

  async function openEdit(document: StockDocument) {
    setSelected(null); setEditing(document); setFormSourceId(document.sourceResponsiblePersonId);
    setInitialSourceBalanceId('');
    setFormType(document.type); setActionError('');
    await loadSources(document.sourceResponsiblePersonId);
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
      setToast('Чернетку успішно збережено');
      await load();
    } catch (reason) {
      setActionError(getErrorMessage(reason));
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
      window.dispatchEvent(new CustomEvent('mvo:refresh-accounting-cards'));
      window.dispatchEvent(new CustomEvent('mvo:refresh-stock-documents'));
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
    documents: filteredDocuments, persons, transferTargets, availableSources, pagination,
    page, setPage, limit, setLimit, draftFilters, setDraftFilters, appliedFilters, setAppliedFilters,
    selected, setSelected, formType, setFormType, formSourceId, initialSourceBalanceId, editing,
    confirming, setConfirming, loading, loadingSources, loadingTargets, saving,
    actionLoading, error, personsError, targetsError, actionError, toast, setToast,
    load, loadReferences, loadSources, openCreate, openDetails, openEdit, save, removeAttachment, perform,
    openConfirmation, closeConfirmation,
  };
}
