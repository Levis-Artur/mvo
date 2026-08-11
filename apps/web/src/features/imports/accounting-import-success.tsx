import { Button, Card, StatusBadge } from '@/components/ui';
import type { ImportBatch } from '@/lib/types';
import { importSummary } from './import-model';

export function AccountingImportSuccess({ batch, onDone }: {
  batch: ImportBatch;
  onDone: () => void;
}) {
  const summary = importSummary(batch);
  const affectedItems = summary.newItems + summary.updatedItems;

  return (
    <section className="accounting-import-success" aria-labelledby="accounting-import-success-title">
      <Card>
        <div className="accounting-import-success__content">
          <StatusBadge tone="success">Успішно</StatusBadge>
          <h1 id="accounting-import-success-title">Відомість успішно завантажено</h1>
          <p className="accounting-import-success__file" title={batch.originalFilename}>{batch.originalFilename}</p>
          <dl className="accounting-import-success__summary">
            <Summary label="МВО" value={batch.preview?.matchedPersons ?? 0} />
            <Summary label="Позицій" value={affectedItems} />
            <Summary label="Рядків" value={summary.imported} />
          </dl>
          <Button type="button" onClick={onDone}>Готово</Button>
        </div>
      </Card>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
