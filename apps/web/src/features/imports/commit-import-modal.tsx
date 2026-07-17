import type { ImportBatch } from '@/lib/types';
import { Button, Card, ErrorState, Modal } from '@/components/ui';
import { importSummary } from './import-model';

export function CommitImportModal({ batch, loading, error, onClose, onCommit }: {
  batch: ImportBatch;
  loading: boolean;
  error: string;
  onClose: () => void;
  onCommit: () => void;
}) {
  const summary = importSummary(batch);
  return (
    <Modal closeOnEscape={!loading} footer={<>
      <Button disabled={loading} variant="outline" type="button" onClick={onClose}>Скасувати</Button>
      <Button disabled={loading} type="button" onClick={onCommit}>{loading ? 'Проведення…' : 'Провести імпорт'}</Button>
    </>} onClose={onClose} size="large" title="Підтвердити проведення імпорту">
      <div className="grid gap-4">
        {error ? <ErrorState message={error} /> : null}
        <Card title="Файл"><p className="break-all font-semibold">{batch.originalFilename}</p></Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Summary label="МВО" value={batch.preview?.matchedPersons ?? 0} />
          <Summary label="Нові позиції" value={summary.newItems} />
          <Summary label="Операції" value={summary.operations} />
          <Summary label="Попередження" value={summary.warnings} />
          <Summary label="Пропущені" value={summary.skipped} />
          <Summary label="Помилки" value={summary.errors} />
        </div>
        <Card title="Що буде створено">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>{summary.operations} операцій руху залишків.</li>
            <li>До {summary.newItems} нових позицій номенклатури.</li>
            <li>Залишки лише для рядків VALID і WARNING.</li>
            <li>{summary.skipped} рядків SKIPPED не буде проведено.</li>
          </ul>
        </Card>
      </div>
    </Modal>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <Card title={label}><p className="text-2xl font-bold tabular-nums">{value}</p></Card>;
}
