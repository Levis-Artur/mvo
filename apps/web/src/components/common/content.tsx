'use client';
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="erp-panel flex flex-col gap-2 border-l-4 border-l-[var(--primary)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd className="break-words text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

