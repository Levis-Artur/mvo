'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button, ErrorState, Pagination, Toast } from '@/components/ui';
import { ADMIN_ENTITY_TYPES } from '@/features/admin/admin-entity-types';
import { DestructiveActionModal } from '@/features/admin/destructive-action-modal';
import { CommitImportModal } from './commit-import-modal';
import { ImportDetailView } from './import-detail-view';
import { ImportUploadModal } from './import-upload-modal';
import { ImportsTable } from './imports-table';
import { useImportsController } from './use-imports-controller';

export function ImportsView({ initialImportId }: { initialImportId?: string }) {
  const controller = useImportsController(initialImportId);
  const [deletingImportId, setDeletingImportId] = useState<string | null>(null);
  const showDetail = Boolean(initialImportId || controller.selected);

  function returnToList() {
    controller.setSelected(null);
    controller.router.push('/imports');
  }

  return (
    <>
      {showDetail ? (
        <ImportDetailView
          actionLoading={controller.actionLoading}
          batch={controller.selected}
          canCommit={controller.canCommit}
          canWrite={controller.canWriteImports}
          detailLoading={controller.detailLoading}
          error={controller.actionError || controller.error}
          filters={controller.rowFilters}
          isOwner={controller.isOwner}
          mappings={controller.mappings}
          missingCounterparties={controller.missingCounterparties}
          pagination={controller.rowPagination}
          persons={controller.persons}
          rows={controller.rows}
          rowsLoading={controller.rowsLoading}
          setFilters={controller.setRowFilters}
          setMappings={controller.setMappings}
          onApplyFilters={(filters) => void controller.loadRows(controller.selected!.id, filters)}
          onBack={returnToList}
          onCancel={() => void controller.cancelSelected()}
          onCommit={() => {
            controller.setCommitError('');
            controller.setConfirmOpen(true);
          }}
          onDelete={() => controller.selected && setDeletingImportId(controller.selected.id)}
          onRollback={() => void controller.rollbackSelected()}
          onSaveMappings={() => void controller.saveMappings()}
          onValidate={() => void controller.validateSelected()}
        />
      ) : (
        <section className="grid min-w-0 gap-4">
          <PageHeader
            action={<div className="flex flex-wrap gap-2">
              <Button disabled={controller.listLoading} icon="refresh" variant="outline" type="button" onClick={() => void controller.loadList(controller.listPagination.page, controller.listPagination.limit)}>Оновити</Button>
              {controller.canWriteImports ? <Button icon="upload" type="button" onClick={() => controller.setUploadOpen(true)}>Новий імпорт</Button> : null}
            </div>}
            description="Завантаження початкових залишків і нових надходжень."
            icon="upload"
            title="Імпорт"
          />
          {controller.error ? <ErrorState message={controller.error} /> : null}
          <ImportsTable imports={controller.imports} loading={controller.listLoading} onOpen={(batch) => void controller.openImport(batch)} />
          <Pagination
            limit={controller.listPagination.limit}
            page={controller.listPagination.page}
            total={controller.listPagination.total}
            totalPages={controller.listPagination.totalPages}
            onLimitChange={(limit) => void controller.loadList(1, limit)}
            onPage={(page) => void controller.loadList(page, controller.listPagination.limit)}
          />
        </section>
      )}
      {controller.uploadOpen && controller.canWriteImports ? (
        <ImportUploadModal onClose={() => controller.setUploadOpen(false)} onSaved={(batch) => {
          controller.setUploadOpen(false);
          controller.router.push(`/imports/${batch.id}`);
          void controller.loadList();
          void controller.loadImport(batch.id);
        }} />
      ) : null}
      {controller.confirmOpen && controller.selected ? (
        <CommitImportModal
          batch={controller.selected}
          error={controller.commitError}
          loading={controller.commitLoading}
          onClose={() => !controller.commitLoading && controller.setConfirmOpen(false)}
          onCommit={() => void controller.commitSelected()}
        />
      ) : null}
      {deletingImportId ? (
        <DestructiveActionModal
          entityId={deletingImportId}
          entityType={ADMIN_ENTITY_TYPES.import}
          onClose={() => setDeletingImportId(null)}
          onDeleted={async () => {
            setDeletingImportId(null);
            returnToList();
            await controller.loadList();
            controller.setToast('Імпорт видалено');
          }}
        />
      ) : null}
      {controller.toast ? <Toast message={controller.toast} onClose={() => controller.setToast('')} /> : null}
    </>
  );
}
