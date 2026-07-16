'use client';

import { useAuth } from '@/app/ui/auth-context';
import { ErrorMessage, LoadingMessage, PageHeader, PaginationControls, Select, Toast } from '@/components/common';
import { fullName } from '@/components/common/formatters';
import { canChangeStockDocuments } from './stock-document-rules';
import { CancelDocumentModal } from './cancel-document-modal';
import { PostDocumentModal } from './post-document-modal';
import { StockDocumentDetailsModal } from './stock-document-details-modal';
import { StockDocumentForm } from './stock-document-form';
import { StockDocumentsTable } from './stock-documents-table';
import { useStockDocumentsController } from './use-stock-documents-controller';

export function StockDocumentsView() {
  const { user } = useAuth();
  if (!user) return <LoadingMessage />;
  return <StockDocumentsContent user={user} />;
}

function StockDocumentsContent({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const controller = useStockDocumentsController(user);
  const writable = canChangeStockDocuments(user);
  return <section className="grid gap-3">
    <PageHeader title="Передачі" description="Документи передачі майна між МВО та видачі зовнішнім одержувачам." action={
      <div className="flex flex-wrap gap-2">
        {writable ? <><button className="btn btn-primary !w-auto" type="button" onClick={() => controller.openCreate('TRANSFER')}>Нова передача</button><button className="btn btn-outline !w-auto" type="button" onClick={() => controller.openCreate('ISSUE')}>Нова видача</button></> : null}
        <button className="btn btn-outline !w-auto" disabled={controller.loading} type="button" onClick={() => void controller.load()}>Оновити</button>
      </div>
    } />
    <div className="erp-panel grid gap-2 p-3 md:grid-cols-4">
      <Select value={controller.type} onChange={(value) => { controller.setPage(1); controller.setType(value as typeof controller.type); }}><option value="">Усі типи</option><option value="TRANSFER">Передача</option><option value="ISSUE">Видача</option></Select>
      <Select value={controller.status} onChange={(value) => { controller.setPage(1); controller.setStatus(value as typeof controller.status); }}><option value="">Усі статуси</option><option value="DRAFT">Чернетка</option><option value="POSTED">Проведено</option><option value="CANCELLED">Скасовано</option></Select>
      <input className="input" type="date" value={controller.dateFrom} onChange={(event) => controller.setDateFrom(event.target.value)} />
      <input className="input" type="date" value={controller.dateTo} onChange={(event) => controller.setDateTo(event.target.value)} />
      <Select value={controller.sourceId} onChange={controller.setSourceId}><option value="">Усі відправники</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</Select>
      <Select value={controller.destinationId} onChange={controller.setDestinationId}><option value="">Усі одержувачі-МВО</option>{controller.persons.map((person) => <option key={person.id} value={person.id}>{fullName(person)}</option>)}</Select>
      <input className="input md:col-span-2" placeholder="Пошук за номером або одержувачем" value={controller.search} onChange={(event) => controller.setSearch(event.target.value)} />
    </div>
    {controller.error ? <ErrorMessage message={controller.error} /> : null}
    {controller.loading ? <LoadingMessage /> : <StockDocumentsTable documents={controller.documents} user={user} onSelect={controller.setSelected} />}
    <PaginationControls page={controller.pagination.page} total={controller.pagination.total} totalPages={controller.pagination.totalPages} onPage={controller.setPage} />
    {controller.formType ? <StockDocumentForm user={user} type={controller.formType} document={controller.editing} persons={controller.persons} balances={controller.balances} loadingBalances={controller.loadingBalances} saving={controller.saving} error={controller.actionError} onSourceChange={(id) => void controller.loadBalances(id)} onSubmit={controller.save} onClose={() => controller.setFormType(null)} /> : null}
    {controller.selected ? <StockDocumentDetailsModal document={controller.selected} user={user} loading={controller.actionLoading} error={controller.actionError} onEdit={() => void controller.openEdit(controller.selected!)} onPost={() => controller.setConfirming('post')} onCancel={() => controller.setConfirming('cancel')} onDelete={() => void controller.perform('remove')} onClose={() => controller.setSelected(null)} /> : null}
    {controller.selected && controller.confirming === 'post' ? <PostDocumentModal document={controller.selected} loading={controller.actionLoading} error={controller.actionError} onConfirm={() => void controller.perform('post')} onClose={() => controller.setConfirming(null)} /> : null}
    {controller.selected && controller.confirming === 'cancel' ? <CancelDocumentModal document={controller.selected} loading={controller.actionLoading} error={controller.actionError} onConfirm={() => void controller.perform('cancel')} onClose={() => controller.setConfirming(null)} /> : null}
    {controller.toast ? <Toast message={controller.toast} onClose={() => controller.setToast('')} /> : null}
  </section>;
}
