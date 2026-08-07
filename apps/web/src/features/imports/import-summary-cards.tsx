import type { ImportBatch } from '@/lib/types';
import { Card } from '@/components/ui';
import { importSummary } from './import-model';

export function ImportSummaryCards({ batch }: { batch: ImportBatch }) {
  const summary = importSummary(batch);
  const values: [string, number][] = [
    ['Кількість рядків', summary.total],
    ['Знайдено МВО', batch.preview?.matchedPersons ?? 0],
    ['Невідомі МВО', batch.preview?.missingPersons ?? 0],
    ['Помилки', summary.errors],
    ['Нові позиції', summary.newItems],
    ['Позиції, що оновлюються', summary.updatedItems],
  ];
  if (batch.status === 'COMPLETED' || batch.status === 'PARTIALLY_COMPLETED') {
    values.push(['Успішно проведено', summary.imported]);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {values.map(([label, value]) => (
        <Card key={label} title={label}><p className="text-2xl font-bold tabular-nums">{value}</p></Card>
      ))}
    </div>
  );
}
