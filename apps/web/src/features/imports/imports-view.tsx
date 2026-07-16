'use client';

import {
  Alert,
  ErrorMessage,
  Modal,
  PageHeader,
  PaginationControls,
  Select,
  SimpleTable,
  Stat,
  StatusPill,
  fullName,
  importTypeLabel,
} from '@/components/common';
import { ImportUploadModal } from './import-upload-modal';
import { useImportsController } from './use-imports-controller';

export function ImportsView({ initialImportId }: { initialImportId?: string }) {
  const {
    canWriteImports,
    router,
    imports,
    selected,
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
    saveMappings,
    validateSelected,
    commitSelected,
    cancelSelected,
    missingCounterparties,
    canCommit,
    refreshRowsWithFilters,
  } = useImportsController(initialImportId);

  return (
    <section className="grid gap-3">
      <PageHeader
        title="Імпорт"
        description="Завантаження початкових залишків і нових надходжень."
        action={
          canWriteImports ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setUploadOpen(true)}
          >
            Новий імпорт
          </button>
          ) : undefined
        }
      />
      {error ? <ErrorMessage message={error} /> : null}
      <SimpleTable
        headers={[
          'Файл',
          'Тип',
          'Статус',
          'Рядків',
          'Помилки',
          'Попередження',
          'Проведено',
        ]}
        rows={imports.map((item) => [
          <span
            key={item.id}
            className="block max-w-72 truncate"
            title={item.originalFilename}
          >
            {item.originalFilename}
          </span>,
          importTypeLabel(item.type),
          <StatusPill key={`${item.id}-status`} status={item.status} />,
          String(item.totalRows),
          String(item.errorRows),
          String(item.warningRows),
          String(item.importedRows),
        ])}
        onRowClick={(index) => void openImport(imports[index])}
      />
      {selected ? (
        <div className="app-card grid gap-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className="truncate text-lg font-semibold"
                title={selected.originalFilename}
              >
                {selected.originalFilename}
              </h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span>{importTypeLabel(selected.type)}</span>
                <StatusPill status={selected.status} />
                <span>
                  {selected.encoding} · {selected.delimiter}
                </span>
              </p>
            </div>
            <button
              className="btn btn-ghost !min-h-0 !w-fit !p-0"
              type="button"
              onClick={() => router.push('/imports')}
            >
              Повернутися до імпортів
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <Stat label="Всього" value={selected.totalRows} />
            <Stat
              label="Валідні"
              value={selected.preview?.validRows ?? selected.validRows}
            />
            <Stat
              label="Попередження"
              value={selected.preview?.warningRows ?? selected.warningRows}
            />
            <Stat
              label="Помилки"
              value={selected.preview?.errorRows ?? selected.errorRows}
            />
            <Stat
              label="Нові позиції"
              value={selected.preview?.newItems ?? 0}
            />
            <Stat
              label="Пропущені"
              value={selected.preview?.skippedRows ?? selected.skippedRows}
            />
            <Stat
              label="Проведені"
              value={selected.preview?.importedRows ?? selected.importedRows}
            />
          </div>
          {(selected.preview?.errorRows ?? selected.errorRows) > 0 ||
          (selected.preview?.warningRows ?? selected.warningRows) > 0 ? (
            <Alert
              tone={
                (selected.preview?.errorRows ?? selected.errorRows) > 0
                  ? 'danger'
                  : 'warning'
              }
              title="Потрібна увага перед проведенням"
              message={`Помилки: ${
                selected.preview?.errorRows ?? selected.errorRows
              }. Попередження: ${
                selected.preview?.warningRows ?? selected.warningRows
              }.`}
            />
          ) : null}
          {canWriteImports && missingCounterparties.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-amber-700/20 bg-amber-50/70 p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--warning)]">
                  Зіставлення контрагентів із МВО
                </p>
                <p className="mt-1 text-sm text-amber-900/80">
                  Оберіть МВО для контрагентів, які не були знайдені автоматично.
                </p>
              </div>
              {missingCounterparties.map((counterparty) => (
                <div
                  key={counterparty}
                  className="grid gap-2 rounded-lg border border-amber-700/10 bg-white p-3 md:grid-cols-[1fr_1fr_auto]"
                >
                  <p className="break-words text-sm font-medium">
                    {counterparty}
                  </p>
                  <Select
                    value={mappings[counterparty]?.responsiblePersonId ?? ''}
                    onChange={(responsiblePersonId) =>
                      setMappings((current) => ({
                        ...current,
                        [counterparty]: {
                          responsiblePersonId,
                          save: current[counterparty]?.save ?? true,
                        },
                      }))
                    }
                  >
                    <option value="">Оберіть МВО</option>
                    {persons.map((person) => (
                      <option key={person.id} value={person.id}>
                        {fullName(person)} · {person.personnelNumber}
                      </option>
                    ))}
                  </Select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      checked={mappings[counterparty]?.save ?? true}
                      type="checkbox"
                      onChange={(event) =>
                        setMappings((current) => ({
                          ...current,
                          [counterparty]: {
                            responsiblePersonId:
                              current[counterparty]?.responsiblePersonId ?? '',
                            save: event.target.checked,
                          },
                        }))
                      }
                    />
                    Зберегти
                  </label>
                </div>
              ))}
              <button
                className="btn btn-primary !w-fit"
                type="button"
                onClick={() => void saveMappings()}
              >
                Зберегти зіставлення
              </button>
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="input"
              placeholder="Пошук у рядках"
              value={rowFilters.search}
              onChange={(event) =>
                setRowFilters((current) => ({
                  ...current,
                  search: event.target.value,
                  page: 1,
                }))
              }
            />
            <Select
              value={rowFilters.status}
              onChange={(status) =>
                setRowFilters((current) => ({ ...current, status, page: 1 }))
              }
            >
              <option value="">Усі статуси</option>
              <option value="VALID">Валідні</option>
              <option value="WARNING">Попередження</option>
              <option value="ERROR">Помилки</option>
              <option value="SKIPPED">Пропущені</option>
              <option value="IMPORTED">Проведені</option>
            </Select>
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => void refreshRowsWithFilters()}
            >
              Застосувати
            </button>
          </div>
          <SimpleTable
            headers={[
              '№',
              'Контрагент',
              'МВО',
              'Код',
              'Назва',
              'Од.',
              'Кількість',
              'Поточний',
              'Кінцевий файл',
              'Розбіжність',
              'Статус',
              'Повідомлення',
            ]}
            rows={rows.map((row) => [
              String(row.rowNumber),
              row.counterpartyRaw,
              row.responsiblePerson
                ? `${row.responsiblePerson.lastName} ${row.responsiblePerson.firstName}`
                : '-',
              row.nomenclatureCodeRaw,
              row.itemNameRaw,
              row.unitOfMeasureRaw ?? '-',
              row.parsedQuantity ?? '-',
              row.systemBalance ?? '-',
              row.fileEndingBalance ?? '-',
              row.balanceDifference ?? '-',
              row.status,
              row.message ?? '-',
            ])}
          />
          <PaginationControls
            page={rowPagination.page}
            totalPages={rowPagination.totalPages}
            total={rowPagination.total}
            onPage={(page) => {
              const next = { ...rowFilters, page };
              setRowFilters(next);
              void refreshRowsWithFilters(next);
            }}
          />
          {canWriteImports ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => void validateSelected()}
              >
                Перевірити повторно
              </button>
              <button
                className="btn btn-primary"
                disabled={!canCommit}
                type="button"
                onClick={() => setConfirmOpen(true)}
              >
                Провести імпорт
              </button>
              <button
                className="btn btn-outline"
                disabled={selected.status === 'COMPLETED'}
                type="button"
                onClick={() => void cancelSelected()}
              >
                Скасувати імпорт
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {uploadOpen && canWriteImports ? (
        <ImportUploadModal
          onClose={() => setUploadOpen(false)}
          onSaved={(batch) => {
            setUploadOpen(false);
            router.push(`/imports/${batch.id}`);
            void load();
            void loadImport(batch.id);
          }}
        />
      ) : null}
      {confirmOpen && selected ? (
        <Modal
          title="Підтвердити проведення імпорту"
          onClose={() => setConfirmOpen(false)}
        >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat
                label="Нові позиції"
                value={selected.preview?.newItems ?? 0}
              />
              <Stat
                label="Операцій"
                value={
                  (selected.preview?.validRows ?? selected.validRows) +
                  (selected.preview?.warningRows ?? selected.warningRows)
                }
              />
              <Stat label="МВО" value={selected.preview?.matchedPersons ?? 0} />
              <Stat
                label="Попередження"
                value={selected.preview?.warningRows ?? selected.warningRows}
              />
              <Stat
                label="Пропущені"
                value={selected.preview?.skippedRows ?? selected.skippedRows}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                Скасувати
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => void commitSelected()}
              >
                Провести
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

