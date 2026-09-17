'use client';

import type { ReadAccessMode } from '@/lib/types';
import { useState } from 'react';
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
import { canChangeStockDocuments, managerCancellationAllowed } from './stock-document-rules';
import { canUseGlobalResponsiblePersonFilters } from './stock-document-loading-policy';
import { CancelDocumentModal } from './cancel-document-modal';
import { StockDocumentDetailsModal } from './stock-document-details-modal';
import { StockDocumentForm } from './stock-document-form';
import { StockDocumentsTable } from './stock-documents-table';
import { DEFAULT_DOCUMENT_FILTERS, useStockDocumentsController } from './use-stock-documents-controller';
import { getManagerReadOnlyPresentationUser } from '@/lib/authz';

export function StockDocumentsView({ managerReadOnly = false }: { managerReadOnly?: boolean } = {}) {
  const { user } = useAuth();
  if (!user) return <LoadingState label="Завантаження документів…" />;
  const viewUser = managerReadOnly
    ? getManagerReadOnlyPresentationUser(user)
    : user;
  return <StockDocumentsContent user={viewUser} managerCancellationEnabled={user.role === 'ORG_MANAGER'} accessMode={managerReadOnly ? 'SCOPED_READ' : undefined} />;
}

function StockDocumentsContent({ user, accessMode, managerCancellationEnabled }: { user: NonNullable<ReturnType<typeof useAuth>['user']>; accessMode?: ReadAccessMode; managerCancellationEnabled: boolean }) {
  const controller = useStockDocumentsController(user, accessMode);
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const writable = canChangeStockDocuments(user);
  const globalPersonFilters = canUseGlobalResponsiblePersonFilters(user.role);
  return <section className={`stock-documents-page grid min-w-0 gap-4 ${user.role === 'MVO' ? 'stock-documents-page--mvo' : ''}`}>
    <PageHeader
      action={<div className="flex flex-wrap gap-2">
        {writable && user.role === 'MVO' ? <Button type="button" onClick={() => controller.openCreate('MVO_TRANSFER')}>Нова передача</Button> : null}
        {user.role !== 'MVO' ? <Button disabled={controller.loading} icon="refresh" variant="outline" type="button" onClick={() => void controller.load()}>Оновити</Button> : null}
      </div>}
      description={user.role === 'MVO' ? 'Створюйте передачі майна іншим МВО та переглядайте їхню історію.' : 'Історія документів руху майна.'}
      helpHref={user.role === 'MVO' ? '/help#transfers' : undefined}
      icon="transfer"
      title={user.role === 'MVO' ? 'Передачі' : 'Документи руху майна'}
    />
    <FilterBar
      dateFrom={user.role !== 'MVO' || advancedFilters ? controller.draftFilters.dateFrom : undefined}
      dateTo={user.role !== 'MVO' || advancedFilters ? controller.draftFilters.dateTo : undefined}
      loading={controller.loading}
      search={controller.draftFilters.search}
      onApply={() => {
        controller.setPage(1);
        controller.setAppliedFilters(controller.draftFilters);
      }}
      onDateFromChange={user.role !== 'MVO' || advancedFilters ? (dateFrom) => controller.setDraftFilters((current) => ({ ...current, dateFrom })) : undefined}
      onDateToChange={user.role !== 'MVO' || advancedFilters ? (dateTo) => controller.setDraftFilters((current) => ({ ...current, dateTo })) : undefined}
      onRefresh={() => void controller.load()}
      onReset={() => {
        controller.setDraftFilters(DEFAULT_DOCUMENT_FILTERS);
        controller.setAppliedFilters(DEFAULT_DOCUMENT_FILTERS);
        controller.setPage(1);
      }}
      onSearchChange={(search) => controller.setDraftFilters((current) => ({ ...current, search }))}
    >
      {user.role !== 'MVO' ? <FilterField label="Тип"><Select value={controller.draftFilters.type} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
        <option value="">Усі типи</option><option value="MVO_TRANSFER">Передача</option><option value="ISSUE">Видача</option>
      </Select></FilterField> : null}
      <FilterField label="Статус"><Select value={controller.draftFilters.status} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
        <option value="">Усі статуси</option><option value="DRAFT">Чернетки</option><option value="POSTED">Проведені</option><option value="CANCELLED">Скасовані</option>
      </Select></FilterField>
      {user.role === 'MVO' ? <Button aria-expanded={advancedFilters} variant="outline" type="button" onClick={() => setAdvancedFilters((current) => !current)}>Додаткові фільтри</Button> : null}
      {globalPersonFilters ? <><FilterField label="Відправник"><Select value={controller.draftFilters.sourceId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, sourceId: event.target.value }))}>
        <option value="">Усі відправники</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{person.externalAccountingCode ?? 'Не вказано'} — {fullName(person)}</option>)}
      </Select></FilterField>
      <FilterField label="Одержувач-МВО"><Select value={controller.draftFilters.destinationId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, destinationId: event.target.value }))}>
        <option value="">Усі одержувачі</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{person.externalAccountingCode ?? 'Не вказано'} — {fullName(person)}</option>)}
      </Select></FilterField></> : null}
    </FilterBar>
    {controller.error ? <ErrorState message={controller.error} /> : null}
    {controller.personsError ? <div className="ui-alert" data-tone="warning" role="status">{controller.personsError}</div> : null}
    <StockDocumentsTable
      documents={controller.documents}
      loading={controller.loading}
      user={user}
      onCancel={(document) => controller.openConfirmation(document)}
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
      availableSources={controller.availableSources}
      error={controller.actionError}
      initialSourceId={controller.formSourceId}
      loadingSources={controller.loadingSources}
      loadingTargets={controller.loadingTargets}
      persons={controller.persons}
      transferTargets={controller.transferTargets}
      saving={controller.saving}
      sourcesError={controller.sourcesError}
      targetsError={controller.targetsError}
      type={controller.formType}
      user={user}
      onClose={controller.closeForm}
      onSourceChange={controller.loadSources}
      onSubmit={controller.save}
    /> : null}
    {controller.selected && !controller.confirming && !controller.formType ? <StockDocumentDetailsModal
      readOnly={accessMode === 'SCOPED_READ'}
      canManagerCancel={managerCancellationEnabled && managerCancellationAllowed(controller.selected, user)}
      document={controller.selected}
      error={controller.actionError}
      loading={controller.actionLoading}
      user={user}
      onCancel={() => controller.openConfirmation(controller.selected!)}
      onClose={() => controller.setSelected(null)}
      onOpenSourceTransfer={(transferId) => void controller.openDetails({ id: transferId })}
    /> : null}
    {controller.selected && controller.confirming === 'cancel' ? <CancelDocumentModal document={controller.selected} requireReason={managerCancellationEnabled} error={controller.actionError} loading={controller.actionLoading} onClose={controller.closeConfirmation} onConfirm={(reason) => void controller.perform(reason)} /> : null}
    {controller.toast ? <Toast message={controller.toast} onClose={() => controller.setToast('')} /> : null}
  </section>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}
