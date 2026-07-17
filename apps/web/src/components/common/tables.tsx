'use client';
import { DataTable, MetricCard, Pagination } from '@/components/ui';

export function Stat({ label, value }: { label: string; value: number }) { return <MetricCard icon="journal" label={label} value={value} />; }
export function SimpleTable({ headers, rows, onRowClick }: { headers: string[]; rows: React.ReactNode[][]; onRowClick?: (index: number) => void }) { return <DataTable ariaLabel="Таблиця даних" emptyMessage="Дані відсутні." headers={headers} rows={rows} onRowClick={onRowClick} />; }
export function PaginationControls({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (page: number) => void }) { return <Pagination page={page} total={total} totalPages={totalPages} onPage={onPage} />; }
