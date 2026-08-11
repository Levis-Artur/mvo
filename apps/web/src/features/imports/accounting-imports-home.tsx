import { formatDateTime } from '@/components/common';
import { PageHeader } from '@/components/layout/page-header';
import { Button, Card, EmptyState, ErrorState, Pagination } from '@/components/ui';
import type { ImportBatch } from '@/lib/types';
import { importSummary } from './import-model';
import { ImportStatusBadge } from './import-status-badge';
import { ImportsTable } from './imports-table';

export function AccountingImportsHome({
  imports,
  latestImport,
  loading,
  error,
  canUpload,
  pagination,
  onUpload,
  onOpen,
  onPage,
  onLimitChange,
}: {
  imports: ImportBatch[];
  latestImport: ImportBatch | null;
  loading: boolean;
  error: string;
  canUpload: boolean;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  onUpload: () => void;
  onOpen: (batch: ImportBatch) => void;
  onPage: (page: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  const latestSummary = latestImport ? importSummary(latestImport) : null;
  const affectedItems = latestSummary
    ? latestSummary.newItems + latestSummary.updatedItems
    : 0;

  return (
    <section className="accounting-imports">
      <PageHeader
        description="Завантажуйте відомості для оновлення залишків матеріально відповідальних осіб."
        icon="upload"
        title="Бухгалтерія"
      />

      <div className="accounting-imports__upload">
        <Button
          className="accounting-imports__primary-action"
          disabled={!canUpload}
          icon="upload"
          type="button"
          onClick={onUpload}
        >
          Завантажити відомість
        </Button>
        <p>Оберіть CSV-файл, перевірте результат аналізу та проведіть імпорт.</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card className="accounting-imports__latest" title="Останнє завантаження">
        {!latestImport && !loading ? (
          <EmptyState message="Відомості ще не завантажувалися." />
        ) : latestImport ? (
          <div className="accounting-imports__latest-content">
            <div className="accounting-imports__latest-main">
              <time dateTime={latestImport.createdAt}>{formatDateTime(latestImport.createdAt)}</time>
              <strong title={latestImport.originalFilename}>{latestImport.originalFilename}</strong>
              <ImportStatusBadge status={latestImport.status} />
            </div>
            <dl className="accounting-imports__latest-summary">
              <Summary label="Оброблено" value={`${latestImport.totalRows} рядків`} />
              <Summary label="МВО" value={String(latestImport.preview?.matchedPersons ?? 0)} />
              <Summary label="Номенклатури" value={String(affectedItems)} />
            </dl>
            <Button variant="outline" type="button" onClick={() => onOpen(latestImport)}>
              Переглянути
            </Button>
          </div>
        ) : (
          <p>Завантаження…</p>
        )}
      </Card>

      <section className="accounting-imports__history" aria-labelledby="accounting-import-history-title">
        <h2 id="accounting-import-history-title">Історія завантажень</h2>
        <ImportsTable compact imports={imports} loading={loading} onOpen={onOpen} />
        <Pagination
          limit={pagination.limit}
          page={pagination.page}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onLimitChange={onLimitChange}
          onPage={onPage}
        />
      </section>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
