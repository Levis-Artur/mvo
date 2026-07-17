import type { ImportBatch } from '@/lib/types';
import { Card } from '@/components/ui';
import { importSummary } from './import-model';

export function ImportSummaryCards({ batch }: { batch: ImportBatch }) {
  const summary = importSummary(batch);
  const values: [string, number][] = [
    ['Усього рядків', summary.total], ['Валідні', summary.valid],
    ['Попередження', summary.warnings], ['Помилки', summary.errors],
    ['Пропущені', summary.skipped], ['Проведені', summary.imported],
    ['Нові позиції', summary.newItems],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {values.map(([label, value]) => (
        <Card key={label} title={label}><p className="text-2xl font-bold tabular-nums">{value}</p></Card>
      ))}
    </div>
  );
}
