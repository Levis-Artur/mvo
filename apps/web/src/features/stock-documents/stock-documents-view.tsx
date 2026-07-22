'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { canChangeStockDocuments } from './stock-document-rules';
import { canUseGlobalResponsiblePersonFilters } from './stock-document-loading-policy';
import { CancelDocumentModal } from './cancel-document-modal';
import { DeleteDocumentModal } from './delete-document-modal';
import { PostDocumentModal } from './post-document-modal';
import { StockDocumentDetailsModal } from './stock-document-details-modal';
import { StockDocumentForm } from './stock-document-form';
import { StockDocumentsTable } from './stock-documents-table';
import { DEFAULT_DOCUMENT_FILTERS, useStockDocumentsController } from './use-stock-documents-controller';
import { DocumentSuccessModal } from './document-success-modal';

export function StockDocumentsView() {
  const { user } = useAuth();
  if (!user) return <LoadingState label="Завантаження документів…" />;
  return <StockDocumentsContent user={user} />;
}

function StockDocumentsContent({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const controller = useStockDocumentsController(user);
  const router = useRouter();
  const [advancedFilters, setAdvancedFilters] = useState(false);
  const writable = canChangeStockDocuments(user);
  const globalPersonFilters = canUseGlobalResponsiblePersonFilters(user.role);
  return <section className={`stock-documents-page grid min-w-0 gap-4 ${user.role === 'MVO' ? 'stock-documents-page--mvo' : ''}`}>
    <PageHeader
      action={<div className="flex flex-wrap gap-2">
        {writable ? <Button type="button" onClick={() => controller.openCreate('MVO_TRANSFER')}>Нова передача</Button> : null}
        {writable ? <Button type="button" onClick={() => controller.openCreate('ISSUE')}>Нова видача</Button> : null}
        {user.role !== 'MVO' ? <Button disabled={controller.loading} icon="refresh" variant="outline" type="button" onClick={() => void controller.load()}>Оновити</Button> : null}
      </div>}
      description="Історія передач майна між МВО та оформлення видач зовнішнім одержувачам."
      icon="transfer"
      title="Передачі та видачі"
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
      <FilterField label="Тип"><Select value={controller.draftFilters.type} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, type: event.target.value as typeof current.type }))}>
        <option value="">Усі типи</option><option value="MVO_TRANSFER">Передача</option><option value="ISSUE">Видача</option><option value="ASSIGNMENT">Передача (стара логіка)</option><option value="TRANSFER">Архівна передача</option>
      </Select></FilterField>
      <FilterField label="Статус"><Select value={controller.draftFilters.status} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, status: event.target.value as typeof current.status }))}>
        <option value="">Усі статуси</option><option value="DRAFT">Чернетки</option><option value="POSTED">Проведені</option><option value="CANCELLED">Скасовані</option>
      </Select></FilterField>
      {user.role === 'MVO' ? <Button aria-expanded={advancedFilters} variant="outline" type="button" onClick={() => setAdvancedFilters((current) => !current)}>Додаткові фільтри</Button> : null}
      {globalPersonFilters ? <><FilterField label="Відправник"><Select value={controller.draftFilters.sourceId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, sourceId: event.target.value }))}>
        <option value="">Усі відправники</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}
      </Select></FilterField>
      <FilterField label="Одержувач-МВО"><Select value={controller.draftFilters.destinationId} onChange={(event) => controller.setDraftFilters((current) => ({ ...current, destinationId: event.target.value }))}>
        <option value="">Усі одержувачі</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{person.personnelNumber} — {fullName(person)}</option>)}
      </Select></FilterField></> : null}
    </FilterBar>
    {controller.error ? <ErrorState message={controller.error} /> : null}
    {controller.personsError ? <div className="ui-alert" data-tone="warning" role="status">{controller.personsError}</div> : null}
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
      availableSources={controller.availableSources}
      document={controller.editing}
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
      onClose={() => controller.setFormType(null)}
      onRemoveAttachment={controller.removeAttachment}
      onSourceChange={controller.loadSources}
      onSubmit={controller.save}
    /> : null}
    {controller.selected && !controller.confirming && !controller.formType && !controller.success ? <StockDocumentDetailsModal
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
    {controller.success ? <DocumentSuccessModal
      document={controller.success.document}
      mode={controller.success.mode}
      onReturn={() => { controller.setSuccess(null); controller.setSelected(null); router.push('/my-stock'); }}
      onView={() => controller.setSuccess(null)}
    /> : null}
    {controller.toast ? <Toast message={controller.toast} onClose={() => controller.setToast('')} /> : null}
  </section>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="filter-bar__field"><span>{label}</span>{children}</label>;
}
