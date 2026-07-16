'use client';
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${
        active
          ? 'border-green-700/15 bg-green-50 text-[var(--success)]'
          : 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-secondary)]'
      }`}
    >
      {active ? 'Активний' : 'Неактивний'}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes('error') || normalized.includes('failed')
      ? 'danger'
      : normalized.includes('warning') || normalized.includes('partial')
        ? 'warning'
        : normalized.includes('completed') || normalized.includes('valid')
          ? 'success'
          : normalized.includes('uploaded')
            ? 'info'
            : 'neutral';

  const toneClass = {
    success: 'border-green-700/15 bg-green-50 text-[var(--success)]',
    warning: 'border-amber-700/15 bg-amber-50 text-[var(--warning)]',
    danger: 'border-red-700/15 bg-red-50 text-[var(--danger)]',
    info: 'border-sky-700/15 bg-sky-50 text-[var(--info)]',
    neutral: 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-secondary)]',
  }[tone];

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
    >
      {status}
    </span>
  );
}

export function Alert({
  tone,
  title,
  message,
}: {
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  title: string;
  message: string;
}) {
  const toneClass = {
    success: 'border-green-700/15 bg-green-50 text-[var(--success)]',
    warning: 'border-amber-700/15 bg-amber-50 text-[var(--warning)]',
    danger: 'border-red-700/15 bg-red-50 text-[var(--danger)]',
    info: 'border-sky-700/15 bg-sky-50 text-[var(--info)]',
    neutral: 'border-slate-200 bg-[var(--surface-muted)] text-[var(--text-primary)]',
  }[tone];

  return (
    <div className={`rounded-lg border p-4 text-sm ${toneClass}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 opacity-85">{message}</p>
    </div>
  );
}

export function LoadingMessage() {
  return (
    <div className="app-card p-4 text-sm text-[var(--text-secondary)]">
      Завантаження даних...
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-700/15 bg-red-50 p-4 text-sm text-[var(--danger)]">
      <p className="font-semibold">Помилка</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="app-card p-6 text-center text-sm text-[var(--text-secondary)]">
      {message}
    </div>
  );
}


