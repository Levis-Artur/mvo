'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui';
import { ImportsView } from '@/features/imports/imports-view';
import { StockView } from '@/features/inventory/stock-view';
import type { AuthUser } from '@/lib/types';
import { AccountingMovementsView } from './accounting-movements-view';
import { AccountingOverview } from './accounting-overview';
import { AccountingTransfersView } from './accounting-transfers-view';
import {
  accountingWorkspaceTabs,
  type AccountingWorkspaceTab,
} from './accounting-workspace-model';

export function AccountingWorkspaceView({ user }: {
  user: Pick<AuthUser, 'role'> | null;
}) {
  const [tab, setTab] = useState<AccountingWorkspaceTab>('overview');

  return (
    <section className="grid min-w-0 gap-4">
      <PageHeader
        description="Імпорти, передачі МВО, рух майна та актуальні залишки."
        icon="journal"
        title="Бухгалтерія"
      />
      <div aria-label="Розділи бухгалтерії" className="flex min-w-0 flex-wrap gap-2" role="tablist">
        {accountingWorkspaceTabs.map((item) => (
          <Button
            aria-selected={tab === item.id}
            key={item.id}
            role="tab"
            type="button"
            variant={tab === item.id ? 'primary' : 'outline'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="min-w-0" role="tabpanel">
        {tab === 'overview' ? <AccountingOverview /> : null}
        {tab === 'imports' ? <ImportsView accountingWorkspace embedded /> : null}
        {tab === 'transfers' ? <AccountingTransfersView embedded user={user} /> : null}
        {tab === 'transactions' ? <AccountingMovementsView /> : null}
        {tab === 'stock' ? <StockView /> : null}
      </div>
    </section>
  );
}
