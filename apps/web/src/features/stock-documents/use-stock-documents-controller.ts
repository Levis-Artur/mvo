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

const emptyPagination: Pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };

export function useStockDocumentsController(user: AuthUser) {
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [pagination, setPagination] = useState(emptyPagination);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<'' | StockDocumentType>('');
  const [status, setStatus] = useState<'' | StockDocumentStatus>('');
  const [sourceId, setSourceId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StockDocument | null>(null);
  const [formType, setFormType] = useState<StockDocumentType | null>(null);
  const [editing, setEditing] = useState<StockDocument | null>(null);
  const [confirming, setConfirming] = useState<'post' | 'cancel' | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [personsError, setPersonsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await stockDocumentsService.list({
        type: type || undefined, status: status || undefined,
        sourceResponsiblePersonId: sourceId || undefined,
        destinationResponsiblePersonId: destinationId || undefined,
        documentDateFrom: dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`).toISOString() : undefined,
        documentDateTo: dateTo ? new Date(`${dateTo}T23:59:59.999Z`).toISOString() : undefined,
        page, limit: 20,
      });
      setDocuments(response.items);
      setPagination(response.pagination);
    } catch (reason) { setError(getErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, destinationId, page, sourceId, status, type]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setPersonsError('');
    fetchAllPages((pagination) =>
      stockDocumentsService.persons({ ...pagination, isActive: true }),
    )
      .then((items) => {
        setPersons(items);
        setPersonsError('');
      })
      .catch((reason) =>
        setPersonsError(
          `Не вдалося завантажити список МВО: ${getErrorMessage(reason)}`,
        ),
      );
  }, []);

  const filteredDocuments = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('uk-UA');
    if (!needle) return documents;
    return documents.filter((document) =>
      [document.documentNumber, document.recipientName, document.recipientUnit]
        .filter(Boolean).some((value) => value!.toLocaleLowerCase('uk-UA').includes(needle)),
    );
  }, [documents, search]);

  async function loadBalances(id: string) {
    setBalances([]);
    setActionError('');
    if (!id) return;
    setLoadingBalances(true);
    try {
      const items = await fetchAllPages((pagination) =>
        stockDocumentsService.balances({
          ...pagination,
          responsiblePersonId: id,
          onlyPositive: true,
        }),
      );
      setBalances(items.filter((item) => Number(item.quantity) > 0));
      setActionError('');
    } catch (reason) {
      setActionError(
        `Не вдалося завантажити залишки відправника: ${getErrorMessage(reason)}`,
      );
    }
    finally { setLoadingBalances(false); }
  }

  function openCreate(nextType: StockDocumentType) {
    setActionError('');
    setEditing(null);
    setFormType(nextType);
    void loadBalances(user.role === 'MVO' ? user.responsiblePersonId ?? '' : '');
  }

  async function openEdit(document: StockDocument) {
    setSelected(null); setEditing(document); setFormType(document.type); setActionError('');
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
    } catch (reason) { setActionError(getErrorMessage(reason)); }
    finally { setSaving(false); }
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
    } catch (reason) { setActionError(getErrorMessage(reason)); }
    finally { setActionLoading(false); }
  }

  return {
    documents: filteredDocuments, persons, balances, pagination, page, setPage,
    type, setType, status, setStatus, sourceId, setSourceId, destinationId, setDestinationId,
    dateFrom, setDateFrom, dateTo, setDateTo, search, setSearch,
    selected, setSelected, formType, setFormType, editing, confirming, setConfirming,
    loading, loadingBalances, saving, actionLoading, error, personsError, actionError, toast, setToast,
    load, loadBalances, openCreate, openEdit, save, perform,
  };
}
