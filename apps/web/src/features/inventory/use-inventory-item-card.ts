'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/components/common';
import { fetchAllPages } from '@/lib/fetch-all-pages';
import type {
  InventoryItemAccountingCard,
  InventoryItemMovementFilters,
  ResponsiblePerson,
  StockDocument,
} from '@/lib/types';
import { downloadFileInBrowser } from '@/features/responsible-persons/my-stock-model';
import { inventoryService } from './inventory.service';
import {
  EMPTY_MOVEMENT_FILTERS,
  inventoryItemCardQuery,
} from './inventory-item-card-model';

export function useInventoryItemCard(inventoryItemId: string) {
  const [card, setCard] = useState<InventoryItemAccountingCard | null>(null);
  const [persons, setPersons] = useState<ResponsiblePerson[]>([]);
  const [draftFilters, setDraftFilters] = useState<InventoryItemMovementFilters>(
    EMPTY_MOVEMENT_FILTERS,
  );
  const [filters, setFilters] = useState<InventoryItemMovementFilters>(
    EMPTY_MOVEMENT_FILTERS,
  );
  const [movementPage, setMovementPage] = useState(1);
  const [movementLimit, setMovementLimit] = useState(20);
  const [documentPage, setDocumentPage] = useState(1);
  const [documentLimit, setDocumentLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personsError, setPersonsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<StockDocument | null>(null);

  const query = useMemo(
    () =>
      inventoryItemCardQuery(
        filters,
        movementPage,
        movementLimit,
        documentPage,
        documentLimit,
      ),
    [
      documentLimit,
      documentPage,
      filters,
      movementLimit,
      movementPage,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCard(
        await inventoryService.inventoryItemAccountingCard(
          inventoryItemId,
          query,
        ),
      );
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [inventoryItemId, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    fetchAllPages((pagination) =>
      inventoryService.responsiblePersons({ ...pagination, isActive: true }),
    )
      .then((items) => {
        if (active) {
          setPersons(items);
          setPersonsError('');
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setPersons([]);
          setPersonsError(getErrorMessage(reason));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function applyFilters() {
    setMovementPage(1);
    setFilters(draftFilters);
  }

  function resetFilters() {
    setDraftFilters(EMPTY_MOVEMENT_FILTERS);
    setFilters(EMPTY_MOVEMENT_FILTERS);
    setMovementPage(1);
  }

  async function exportHistory() {
    setExporting(true);
    setActionError('');
    try {
      const file = await inventoryService.exportInventoryItemHistoryCsv(
        inventoryItemId,
        filters,
      );
      downloadFileInBrowser(file);
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }

  async function openStockDocument(id: string) {
    setDocumentLoading(true);
    setActionError('');
    try {
      setSelectedDocument(await inventoryService.stockDocument(id));
    } catch (reason) {
      setActionError(getErrorMessage(reason));
    } finally {
      setDocumentLoading(false);
    }
  }

  return {
    card,
    persons,
    draftFilters,
    movementPage,
    movementLimit,
    documentPage,
    documentLimit,
    loading,
    error,
    actionError,
    personsError,
    exporting,
    documentLoading,
    selectedDocument,
    setDraftFilters,
    setMovementPage,
    setMovementLimit,
    setDocumentPage,
    setDocumentLimit,
    setSelectedDocument,
    applyFilters,
    resetFilters,
    exportHistory,
    openStockDocument,
    load,
  };
}
