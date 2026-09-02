'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui';
import { PersonsView } from '@/features/responsible-persons/persons-view';
import { StockView } from '@/features/inventory/stock-view';
import { TransactionsView } from '@/features/inventory/transactions-view';
import { StockDocumentsView } from '@/features/stock-documents/stock-documents-view';

type ManagerSection = 'persons' | 'stock' | 'transactions' | 'transfers';

const sections: Array<{ id: ManagerSection; label: string }> = [
  { id: 'persons', label: 'МВО' },
  { id: 'stock', label: 'Залишки' },
  { id: 'transactions', label: 'Журнал операцій' },
  { id: 'transfers', label: 'Передачі' },
];

export function ManagerReadOnlyView() {
  const [section, setSection] = useState<ManagerSection>('persons');

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        description="Додатковий доступ у вибраних областях. Усі дані доступні лише для перегляду. Операції з майном залишаються доступними тільки у власному обліку МВО."
        icon="shield"
        title="Менеджерський перегляд"
      />
      <nav aria-label="Розділи менеджерського перегляду" className="flex flex-wrap gap-2">
        {sections.map((item) => (
          <Button
            key={item.id}
            aria-pressed={section === item.id}
            type="button"
            variant={section === item.id ? 'primary' : 'outline'}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      {section === 'persons' ? <PersonsView /> : null}
      {section === 'stock' ? <StockView /> : null}
      {section === 'transactions' ? <TransactionsView /> : null}
      {section === 'transfers' ? <StockDocumentsView managerReadOnly /> : null}
    </section>
  );
}
