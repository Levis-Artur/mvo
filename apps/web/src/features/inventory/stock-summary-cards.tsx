import { Card } from '@/components/ui';
import type { StockBalance } from '@/lib/types';
import { formatQuantity } from './quantity-format';
import { stockSummary } from './stock-model';

export function StockSummaryCards({ balances }: { balances: StockBalance[] }) {
  const summary = stockSummary(balances);
  const cards = [
    ['МВО із залишками', String(summary.responsiblePersons)],
    ['Позицій', String(summary.positions)],
    ['Загальна кількість', formatQuantity(summary.totalQuantity)],
    ['Нульові або проблемні', String(summary.problematic)],
    [
      'Останнє оновлення',
      summary.updatedAt
        ? new Date(summary.updatedAt).toLocaleString('uk-UA')
        : 'Немає даних',
    ],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <Card key={label} title={label}>
          <p className="break-words text-xl font-bold tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}
