'use client';
import type { FormEvent } from 'react';
import { Button } from './button';
import { Input } from './input';
import { runFilterAction } from './filter-bar-model';

export function FilterBar({ search, onSearchChange, onApply, onReset, onRefresh, children, dateFrom, dateTo, onDateFromChange, onDateToChange, loading = false }: { search?: string; onSearchChange?: (value: string) => void; onApply: () => void; onReset: () => void; onRefresh: () => void; children?: React.ReactNode; dateFrom?: string; dateTo?: string; onDateFromChange?: (value: string) => void; onDateToChange?: (value: string) => void; loading?: boolean }) {
  function submit(event: FormEvent) { event.preventDefault(); runFilterAction(onApply); }
  return <form className="filter-bar" onSubmit={submit}>{onSearchChange ? <label className="filter-bar__field"><span>Пошук</span><Input aria-label="Пошук" type="search" value={search ?? ''} onChange={(event) => onSearchChange(event.target.value)} /></label> : null}{children}{onDateFromChange ? <label className="filter-bar__field"><span>Дата від</span><Input type="date" value={dateFrom ?? ''} onChange={(event) => onDateFromChange(event.target.value)} /></label> : null}{onDateToChange ? <label className="filter-bar__field"><span>Дата до</span><Input type="date" value={dateTo ?? ''} onChange={(event) => onDateToChange(event.target.value)} /></label> : null}<div className="filter-bar__actions"><Button disabled={loading} type="submit">Застосувати</Button><Button disabled={loading} variant="outline" type="button" onClick={() => runFilterAction(onReset)}>Очистити</Button><Button disabled={loading} icon="refresh" variant="outline" type="button" onClick={() => runFilterAction(onRefresh)}>Оновити</Button></div></form>;
}
