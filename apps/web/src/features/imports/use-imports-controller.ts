'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/ui/auth-context';
import { getErrorMessage } from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { can } from '@/lib/authz';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type { ImportBatch, ImportRow, ResponsiblePerson } from '@/lib/types';
import { executeImportCommit } from './commit-import';
import { importsService as apiClient } from './imports.service';

export type ImportRowFilters = {
  search: string;
  status: string;
  page: number;
  limit: number;
};

const DEFAULT_ROW_FILTERS: ImportRowFilters = {
  search: '',
  status: '',
  page: 1,
  limit: 20,
};

export function useImportsController(initialImportId?: string) {
  const { user } = useAuth();
  const router = useRouter();
  const canWriteImports = can(user, 'write', 'imports');
  const isOwner = user?.role === 'OWNER';
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [listPagination, setListPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [rowFilters, setRowFilters] = useState(DEFAULT_ROW_FILTERS);
  const [rowPagination, setRowPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [mappings, setMappings] = useState<Record<string, { responsiblePersonId: string; save: boolean }>>({});
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(Boolean(initialImportId));
  const [rowsLoading, setRowsLoading] = useState(Boolean(initialImportId));
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [toast, setToast] = useState('');

  const loadList = useCallback(async (page = 1, limit = 20) => {
    setListLoading(true);
    setError('');
    try {
      const response = await apiClient.imports({ page, limit: Math.min(limit, 100) });
      setImports(response.items);
      setListPagination(response.pagination);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadPersons = useCallback(async () => {
    const result = await fetchAllPages((pagination) =>
      apiClient.responsiblePersons({ isActive: true, ...pagination }),
    );
    setPersons(result);
  }, []);

  const loadRows = useCallback(async (id: string, filters: ImportRowFilters) => {
    setRowsLoading(true);
    setActionError('');
    try {
      const response = await apiClient.getImportRows(id, {
        search: filters.search,
        status: filters.status || undefined,
        page: filters.page,
        limit: Math.min(filters.limit, 100),
      });
      setRows(response.items);
      setRowPagination(response.pagination);
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setRowsLoading(false);
    }
  }, []);

  const loadImport = useCallback(async (id: string, filters = DEFAULT_ROW_FILTERS) => {
    setDetailLoading(true);
    setError('');
    try {
      const [batch] = await Promise.all([
        apiClient.getImportBatch(id),
        loadRows(id, filters),
      ]);
      setSelected(batch);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setDetailLoading(false);
    }
  }, [loadRows]);

  useEffect(() => {
    void loadList();
    void loadPersons().catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [loadList, loadPersons]);

  useEffect(() => {
    if (initialImportId) void loadImport(initialImportId, DEFAULT_ROW_FILTERS);
  }, [initialImportId, loadImport]);

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    await Promise.all([
      loadImport(selected.id, rowFilters),
      loadList(listPagination.page, listPagination.limit),
    ]);
  }, [listPagination.limit, listPagination.page, loadImport, loadList, rowFilters, selected]);

  useEffect(() => {
    if (window.sessionStorage.getItem('mvo:open-import-upload') === '1') {
      window.sessionStorage.removeItem('mvo:open-import-upload');
      setUploadOpen(true);
    }
  }, []);

  useEffect(() => {
    function handleToolbar(event: Event) {
      const detail = getToolbarDetail(event);
      if (detail?.view !== 'imports') return;
      if (detail.action === 'new-import') setUploadOpen(true);
      if (detail.action === 'refresh') {
        void loadList(listPagination.page, listPagination.limit);
        void reloadSelected();
      }
    }
    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [listPagination.limit, listPagination.page, loadList, reloadSelected]);

  async function runAction(action: () => Promise<unknown>, success: string) {
    setActionLoading(true);
    setActionError('');
    try {
      await action();
      await reloadSelected();
      setToast(success);
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setActionLoading(false);
    }
  }

  async function openImport(batch: ImportBatch) {
    router.push(`/imports/${batch.id}`);
    await loadImport(batch.id, DEFAULT_ROW_FILTERS);
  }

  async function saveMappings() {
    if (!selected) return;
    const payload = Object.entries(mappings)
      .filter(([, value]) => value.responsiblePersonId)
      .map(([counterpartyRaw, value]) => ({
        counterpartyRaw,
        responsiblePersonId: value.responsiblePersonId,
        saveExternalAccountingName: value.save,
      }));
    if (!payload.length) return;
    await runAction(
      () => apiClient.updateImportMappings(selected.id, { mappings: payload }),
      'Зіставлення збережено',
    );
    setMappings({});
  }

  async function commitSelected() {
    if (!selected) return;
    await executeImportCommit({
      commit: () => apiClient.commitImport(selected.id),
      setLoading: setCommitLoading,
      setError: setCommitError,
      getErrorMessage,
      onSuccess: async (batch) => {
        setSelected(batch);
        await Promise.all([
          loadImport(batch.id, rowFilters),
          loadList(listPagination.page, listPagination.limit),
        ]);
        window.dispatchEvent(new CustomEvent('mvo:refresh-stock'));
        window.dispatchEvent(new CustomEvent('mvo:refresh-transactions'));
        router.refresh();
        setConfirmOpen(false);
        setToast('Імпорт успішно проведено');
      },
    });
  }

  const missingCounterparties = useMemo(() => Array.from(new Set(
    rows
      .filter((row) => !row.responsiblePerson && row.status !== 'SKIPPED' && row.counterpartyRaw)
      .map((row) => row.counterpartyRaw),
  )), [rows]);

  return {
    canWriteImports, isOwner, router,
    imports, listPagination, selected, setSelected, rows, persons,
    rowFilters, setRowFilters, rowPagination, mappings, setMappings,
    listLoading, detailLoading, rowsLoading, actionLoading,
    error, actionError, uploadOpen, setUploadOpen, confirmOpen, setConfirmOpen,
    commitLoading, commitError, setCommitError, toast, setToast,
    loadList, loadImport, loadRows, openImport, reloadSelected, saveMappings, commitSelected,
    validateSelected: () => selected && runAction(() => apiClient.validateImport(selected.id), 'Імпорт повторно перевірено'),
    cancelSelected: () => selected && runAction(() => apiClient.cancelImport(selected.id), 'Імпорт скасовано'),
    rollbackSelected: () => selected && runAction(() => apiClient.rollbackImport(selected.id), 'Імпорт відкочено'),
    missingCounterparties,
    canCommit: selected?.status === 'VALIDATED' && (selected.preview?.errorRows ?? 1) === 0,
  };
}
