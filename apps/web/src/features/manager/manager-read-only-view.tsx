'use client';

import { useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui';
import { PersonsView } from '@/features/responsible-persons/persons-view';
import { StockView } from '@/features/inventory/stock-view';
import { TransactionsView } from '@/features/inventory/transactions-view';
import { StockDocumentsView } from '@/features/stock-documents/stock-documents-view';
import { ReadOnlyIssueHistory } from '@/features/stock-documents/read-only-issue-history';

type ManagerSection = 'persons' | 'stock' | 'transactions' | 'transfers' | 'issues';

const sections: Array<{ id: ManagerSection; label: string }> = [
  { id: 'persons', label: 'МВО' },
  { id: 'stock', label: 'Залишки' },
  { id: 'transactions', label: 'Журнал операцій' },
  { id: 'transfers', label: 'Передачі' },
  { id: 'issues', label: 'Видачі' },
];

export function ManagerReadOnlyView() {
  const { user } = useAuth();
  const [section, setSection] = useState<ManagerSection>('persons');

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        description={user?.role === 'ORG_MANAGER'
          ? 'Доступ у вибраних областях. Операції від імені конкретного МВО доступні в його картці.'
          : 'Додатковий доступ у вибраних областях. Усі дані доступні лише для перегляду. Операції з майном залишаються доступними тільки у власному обліку МВО.'}
        helpHref="/help#manager"
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
      {section === 'persons' ? <PersonsView accessMode="SCOPED_READ" /> : null}
      {section === 'stock' ? <StockView accessMode="SCOPED_READ" showSystemSummary={false} /> : null}
      {section === 'transactions' ? <TransactionsView accessMode="SCOPED_READ" /> : null}
      {section === 'transfers' ? <StockDocumentsView managerReadOnly /> : null}
      {section === 'issues' ? <ReadOnlyIssueHistory /> : null}
    </section>
  );
}
