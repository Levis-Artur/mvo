'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { importsService as apiClient } from './imports.service';
import { useAuth } from '@/app/ui/auth-context';
import { can } from '@/lib/authz';
import type { ImportBatch, ImportRow, ResponsiblePerson } from '@/lib/types';
import { getErrorMessage } from '@/components/common';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';


export function useImportsController(initialImportId?: string) {
  const { user } = useAuth();
  const canWriteImports = can(user, 'write', 'imports');
  const isOwner = user?.role === 'OWNER';
  const router = useRouter();
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [selected, setSelected] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [rowFilters, setRowFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 20,
  });
  const [rowPagination, setRowPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [mappings, setMappings] = useState<
    Record<string, { responsiblePersonId: string; save: boolean }>
  >({});
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [response, personsResponse] = await Promise.all([
        apiClient.imports({ limit: 50 }),
        apiClient.responsiblePersons({ isActive: true, limit: 100 }),
      ]);
      setImports(response.items);
      setPersons(personsResponse.items);
    } catch (reason) {
      setError(getErrorMessage(reason));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadImport = useCallback(
    async (id: string) => {
      const [batch, response] = await Promise.all([
        apiClient.getImportBatch(id),
        apiClient.getImportRows(id, {
          search: rowFilters.search,
          status: rowFilters.status || undefined,
          page: rowFilters.page,
          limit: rowFilters.limit,
        }),
      ]);
      setSelected(batch);
      setRows(response.items);
      setRowPagination(response.pagination);
    },
    [rowFilters],
  );

  useEffect(() => {
    if (initialImportId) {
      loadImport(initialImportId).catch((reason: unknown) =>
        setError(getErrorMessage(reason)),
      );
    }
  }, [initialImportId, loadImport]);

  async function openImport(importBatch: ImportBatch) {
    router.push(`/imports/${importBatch.id}`);
    await loadImport(importBatch.id);
  }

  const reloadSelected = useCallback(async () => {
    if (!selected) return;
    await loadImport(selected.id);
    await load();
  }, [load, loadImport, selected]);

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

      if (detail.action === 'new-import') {
        setUploadOpen(true);
      }

      if (detail.action === 'refresh') {
        void load();
        void reloadSelected();
      }
    }

    window.addEventListener(TOOLBAR_EVENT, handleToolbar);
    return () => window.removeEventListener(TOOLBAR_EVENT, handleToolbar);
  }, [load, reloadSelected]);

  async function saveMappings() {
    if (!selected) return;
    const payload = Object.entries(mappings)
      .filter(([, value]) => value.responsiblePersonId)
      .map(([counterpartyRaw, value]) => ({
        counterpartyRaw,
        responsiblePersonId: value.responsiblePersonId,
        saveExternalAccountingName: value.save,
      }));

    if (payload.length === 0) return;

    await apiClient.updateImportMappings(selected.id, { mappings: payload });
    setMappings({});
    await reloadSelected();
  }

  async function validateSelected() {
    if (!selected) return;
    await apiClient.validateImport(selected.id);
    await reloadSelected();
  }

  async function commitSelected() {
    if (!selected) return;
    setSelected(await apiClient.commitImport(selected.id));
    setConfirmOpen(false);
    await reloadSelected();
  }

  async function cancelSelected() {
    if (!selected) return;
    await apiClient.cancelImport(selected.id);
    await reloadSelected();
  }

  const missingCounterparties = Array.from(
    new Set(
      rows
        .filter(
          (row) =>
            !row.responsiblePerson &&
            row.status !== 'SKIPPED' &&
            row.counterpartyRaw,
        )
        .map((row) => row.counterpartyRaw),
    ),
  );

  const canCommit =
    selected?.status === 'VALIDATED' &&
    (selected.preview?.errorRows ?? 1) === 0;

  async function refreshRowsWithFilters(nextFilters = rowFilters) {
    if (!selected) return;
    const response = await apiClient.getImportRows(selected.id, {
      search: nextFilters.search,
      status: nextFilters.status || undefined,
      page: nextFilters.page,
      limit: nextFilters.limit,
    });
    setRows(response.items);
    setRowPagination(response.pagination);
  }

  return {
    canWriteImports,
    isOwner,
    router,
    imports,
    selected,
    setSelected,
    rows,
    persons,
    rowFilters,
    setRowFilters,
    rowPagination,
    mappings,
    setMappings,
    error,
    uploadOpen,
    setUploadOpen,
    confirmOpen,
    setConfirmOpen,
    load,
    loadImport,
    openImport,
    reloadSelected,
    saveMappings,
    validateSelected,
    commitSelected,
    cancelSelected,
    missingCounterparties,
    canCommit,
    refreshRowsWithFilters,
  };
}

