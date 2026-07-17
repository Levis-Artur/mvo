'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { fullName } from '@/components/common/formatters';
import { PageHeader } from '@/components/layout/page-header';
import {
  Button,
  ErrorState,
  FilterBar,
  LoadingState,
  Pagination,
  Select,
  Toast,
} from '@/components/ui';
import { canChangeStockDocuments, parseStockDocumentQuickAction } from './stock-document-rules';
import { CancelDocumentModal } from './cancel-document-modal';
import { DeleteDocumentModal } from './delete-document-modal';
import { PostDocumentModal } from './post-document-modal';
import { StockDocumentDetailsModal } from './stock-document-details-modal';
import { StockDocumentForm } from './stock-document-form';
import { StockDocumentsTable } from './stock-documents-table';
import { DEFAULT_DOCUMENT_FILTERS, useStockDocumentsController } from './use-stock-documents-controller';

export function StockDocumentsView() {
  const { user } = useAuth();
  if (!user) return <LoadingState label="Завантаження документів…" />;
  return <StockDocumentsContent user={user} />;
}

function StockDocumentsContent({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const controller = useStockDocumentsController(user);
  const writable = canChangeStockDocuments(user);
  const quickActionHandled = useRef(false);

  useEffect(() => {
    if (quickActionHandled.current || !writable) return;
    quickActionHandled.current = true;
    const action = parseStockDocumentQuickAction(window.location.search);
    if (!action) return;
    controller.openCreate(action.type, action.sourceResponsiblePersonId);
  }, [controller, writable]);

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={<div className="flex flex-wrap gap-2">
        {writable ? <>
          <Button icon="transfer" type="button" onClick={() => controller.openCreate('TRANSFER')}>Нова передача</Button>
          <Button variant="outline" type="button" onClick={() => controller.openCreate('ISSUE')}>Нова видача</Button>
        </> : null}
        <Button disabled={controller.loading} icon="refresh" variant="outline" type="button" onClick={() => void controller.load()}>Оновити</Button>
      </div>}
      description="Документи передачі майна між МВО та видачі зовнішнім одержувачам."
      icon="transfer"
      title="Передачі та видачі"
    />
    <FilterBar
      dateFrom={controller.draftFilters.dateFrom}
      dateTo={controller.draftFilters.dateTo}
      loading={controller.loading}
      search={controller.draftFilters.search}
      onApply={() => {
        controller.setPage(1);
        controller.setAppliedFilters(controller.draftFilters);
      }}
      onDateFromChange={(dateFrom) => controller.setDraftFilters((current) => ({ ...current, dateFrom }))}
      onDateToChange={(dateTo) => controller.setDraftFilters((current) => ({ ...current, dateTo }))}
      onRefresh={() => void controller.load()}
      onReset={() => {
        controller.setDraftFilters(DEFAULT_DOCUMENT_FILTERS);
        controller.setAppliedFilters(DEFAULT_DOCUMENT_FILTERS);
        controller.setPage(1);
      }}
      onSearchChange={(search) => controller.setDraftFilters((current) => ({ ...current, search }))}
    >
      <FilterField label="Тип"><Select value={controller.draftFilters.type} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
        <option value="">Усі типи</option><option value="TRANSFER">Передача</option><option value="ISSUE">Видача</option>
      </Select></FilterField>
      <FilterField label="Статус"><Select value={controller.draftFilters.status} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
        <option value="">Усі статуси</option><option value="DRAFT">DRAFT</option><option value="POSTED">POSTED</option><option value="CANCELLED">CANCELLED</option>
      </Select></FilterField>
      <FilterField label="Відправник"><Select value={controller.draftFilters.sourceId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, sourceId: event.target.value }))}>
        <option value="">Усі відправники</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}
      </Select></FilterField>
      <FilterField label="Одержувач-МВО"><Select value={controller.draftFilters.destinationId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, destinationId: event.target.value }))}>
        <option value="">Усі одержувачі</option>{controller.transferTargets.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}
      </Select></FilterField>
    </FilterBar>
    {controller.error ? <ErrorState message={controller.error} /> : null}
    {controller.personsError ? <ErrorState message={controller.personsError} /> : null}
    {controller.targetsError ? <ErrorState message={controller.targetsError} /> : null}
    <StockDocumentsTable
      documents={controller.documents}
      loading={controller.loading}
      user={user}
      onCancel={(document) => controller.openConfirmation('cancel', document)}
      onEdit={(document) => void controller.openEdit(document)}
      onPost={(document) => controller.openConfirmation('post', document)}
      onRemove={(document) => controller.openConfirmation('remove', document)}
      onView={(document) => void controller.openDetails(document)}
    />
    <Pagination
      limit={controller.pagination.limit}
      page={controller.pagination.page}
      total={controller.pagination.total}
      totalPages={controller.pagination.totalPages}
      onLimitChange={(limit) => { controller.setLimit(limit); controller.setPage(1); }}
      onPage={controller.setPage}
    />
    {controller.formType ? <StockDocumentForm
      balances={controller.balances}
      document={controller.editing}
      error={controller.actionError}
      initialSourceId={controller.formSourceId}
      loadingBalances={controller.loadingBalances}
      loadingTargets={controller.loadingTargets}
      persons={controller.persons}
      saving={controller.saving}
      targetsError={controller.targetsError}
      transferTargets={controller.transferTargets}
      type={controller.formType}
      user={user}
      onClose={() => controller.setFormType(null)}
      onSourceChange={(id) => void controller.loadBalances(id)}
      onSubmit={controller.save}
    /> : null}
    {controller.selected && !controller.confirming && !controller.formType ? <StockDocumentDetailsModal
      document={controller.selected}
      error={controller.actionError}
      loading={controller.actionLoading}
      user={user}
      onCancel={() => controller.openConfirmation('cancel', controller.selected!)}
      onClose={() => controller.setSelected(null)}
      onDelete={() => controller.openConfirmation('remove', controller.selected!)}
      onEdit={() => void controller.openEdit(controller.selected!)}
      onPost={() => controller.openConfirmation('post', controller.selected!)}
    /> : null}
    {controller.selected && controller.confirming === 'post' ? <PostDocumentModal document={controller.selected} error={controller.actionError} loading={controller.actionLoading} onClose={controller.closeConfirmation} onConfirm={() => void controller.perform('post')} /> : null}
    {controller.selected && controller.confirming === 'cancel' ? <CancelDocumentModal document={controller.selected} error={controller.actionError} loading={controller.actionLoading} onClose={controller.closeConfirmation} onConfirm={() => void controller.perform('cancel')} /> : null}
    {controller.selected && controller.confirming === 'remove' ? <DeleteDocumentModal document={controller.selected} error={controller.actionError} loading={controller.actionLoading} onClose={controller.closeConfirmation} onConfirm={() => void controller.perform('remove')} /> : null}
    {controller.toast ? <Toast message={controller.toast} onClose={() => controller.setToast('')} /> : null}
  </section>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}
