'use client';
import { Button } from './button';
import { Select } from './select';
import { normalizePageLimit, SUPPORTED_PAGE_LIMITS } from './pagination-model';

export function Pagination({ page, totalPages, total, limit = 20, onPage, onLimitChange }: {
  page: number; totalPages: number; total: number; limit?: number;
  onPage: (page: number) => void; onLimitChange?: (limit: number) => void;
}) {
  const safeLimit = normalizePageLimit(limit);
  return <nav aria-label="Пагінація" className="ui-pagination">
    <span>Записів: {total}. Сторінка {page} з {totalPages || 1}</span>
    <div className="ui-pagination__actions">
      {onLimitChange ? <label className="ui-pagination__limit"><span>На сторінці</span><Select aria-label="Кількість записів на сторінці" value={safeLimit} onChange={(event) => onLimitChange(normalizePageLimit(Number(event.target.value)))}>{SUPPORTED_PAGE_LIMITS.map((value) => <option key={value} value={value}>{value}</option>)}</Select></label> : null}
      <Button disabled={page <= 1} variant="outline" type="button" onClick={() => onPage(page - 1)}>Назад</Button>
      <Button disabled={totalPages <= 0 || page >= totalPages} variant="outline" type="button" onClick={() => onPage(page + 1)}>Далі</Button>
    </div>
  </nav>;
}
