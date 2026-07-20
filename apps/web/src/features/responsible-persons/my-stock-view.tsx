'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { getErrorMessage } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import { Button, Card, DataTable, ErrorState, LoadingState, StatusBadge } from '@/components/ui';
import { formatQuantity } from '@/features/inventory/quantity-format';
import { mvoStockActionLinks } from '@/features/inventory/stock-model';
import { MY_STOCK_SECTION_LABELS, myStockSources, type MyStockSection } from '@/features/inventory/custody-model';
import type { AvailableStockSource, ResponsiblePersonAccountingCard } from '@/lib/types';
import { getToolbarDetail, TOOLBAR_EVENT } from '@/components/layout/toolbar-events';
import { responsiblePersonsService } from './responsible-persons.service';

const tabs = (Object.entries(MY_STOCK_SECTION_LABELS) as [MyStockSection, string][])
  .map(([id, label]) => ({ id, label }));

export function MyStockView() {
  const { user } = useAuth();
  const personId = user?.responsiblePersonId ?? '';
  const links = mvoStockActionLinks(personId);
  const [card, setCard] = useState<ResponsiblePersonAccountingCard | null>(null);
  const [available, setAvailable] = useState<AvailableStockSource[]>([]);
  const [tab, setTab] = useState<MyStockSection>('direct');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!personId) {
      setLoading(false);
      setError('До користувача не прив’язано картку МВО.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextCard, nextAvailable] = await Promise.all([
        responsiblePersonsService.responsiblePersonAccountingCard(personId),
        responsiblePersonsService.availableStockToMe(),
      ]);
      setCard(nextCard);
      setAvailable(nextAvailable);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    function refresh(event: Event) {
      const detail = getToolbarDetail(event);
      if (!detail || (detail.view === 'my-stock' && detail.action === 'refresh')) void load();
    }
    window.addEventListener(TOOLBAR_EVENT, refresh);
    window.addEventListener('mvo:refresh-accounting-cards', refresh);
    return () => {
      window.removeEventListener(TOOLBAR_EVENT, refresh);
      window.removeEventListener('mvo:refresh-accounting-cards', refresh);
    };
  }, [load]);

  const rows = useMemo(() => card ? myStockRows(card, available, tab) : [], [available, card, tab]);

  return <section className="grid min-w-0 gap-4">
    <PageHeader
      action={personId ? <div className="flex flex-wrap gap-2"><a className="btn btn-primary" href={links.transfer}>Передати</a><a className="btn btn-outline" href={links.issue}>Видати</a><Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => void load()}>Оновити</Button></div> : undefined}
      description="Прямий залишок і майно, закріплене за фактичними утримувачами."
      icon="box"
      title="Моє майно"
    />
    {loading ? <LoadingState label="Завантаження облікової картки…" /> : null}
    {error ? <ErrorState message={error} /> : null}
    {card ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Разом під моїм обліком" value={card.totalOwnedAccountingQuantity} />
        <Metric label="Фактично утримую" value={card.totalPhysicallyHeldQuantity} />
        <Metric label="Закріплень за іншими" value={String(card.assignedToOthers.length)} />
        <Metric label="Закріплень за мною" value={String(card.assignedToMe.length)} />
      </div>
      <nav aria-label="Склад майна" className="flex flex-wrap gap-2">{tabs.map((item) => <Button aria-current={tab === item.id ? 'page' : undefined} key={item.id} variant={tab === item.id ? 'primary' : 'outline'} type="button" onClick={() => setTab(item.id)}>{item.label}</Button>)}</nav>
      <DataTable
        ariaLabel={tabs.find((item) => item.id === tab)?.label ?? 'Моє майно'}
        columns={[{ label: 'Код' }, { label: 'Назва' }, { label: 'Одиниця' }, { label: 'Обліковий власник' }, { label: 'Фактичний утримувач' }, { label: 'Тип' }, { label: 'Кількість', numeric: true }, { label: 'Доступно для передачі' }, { label: 'Доступно для видачі' }, { label: 'Дії', actions: true }]}
        emptyMessage="У цьому розділі майна немає."
        rows={rows}
      />
    </> : null}
  </section>;
}

function myStockRows(card: ResponsiblePersonAccountingCard, available: AvailableStockSource[], tab: MyStockSection) {
  const sources = myStockSources(card, available, tab);
  return sources.map((source) => [
    source.inventoryItem.externalCode,
    source.inventoryItem.name,
    source.inventoryItem.unitOfMeasure ?? '—',
    source.accountingOwner.fullName,
    source.currentCustodian.fullName,
    <StatusBadge key="kind" tone={source.sourceKind === 'DIRECT' ? 'success' : 'info'}>{source.sourceKind}</StatusBadge>,
    formatQuantity(source.availableQuantity),
    source.canAssign ? 'Так' : 'Ні',
    source.canIssue ? 'Так' : 'Ні',
    source.canAssign || source.canIssue ? <div className="flex flex-wrap justify-end gap-1" key="actions">{source.canAssign ? <a className="btn btn-ghost" href={`/transfers?create=ASSIGNMENT&sourceResponsiblePersonId=${encodeURIComponent(source.currentCustodian.id)}&sourceBalanceId=${encodeURIComponent(source.sourceBalanceId)}`}>Передати</a> : null}{source.canIssue ? <a className="btn btn-ghost" href={`/transfers?create=ISSUE&sourceResponsiblePersonId=${encodeURIComponent(source.currentCustodian.id)}&sourceBalanceId=${encodeURIComponent(source.sourceBalanceId)}`}>Видати</a> : null}</div> : 'Лише перегляд',
  ]);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card title={label}><p className="text-xl font-bold tabular-nums">{formatQuantity(value)}</p></Card>;
}
