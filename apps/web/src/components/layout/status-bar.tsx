'use client';

export function StatusBar({ apiState, currentPage, userLabel }: { apiState: 'checking' | 'available' | 'unavailable'; currentPage: string; userLabel: string }) {
  return <footer className="flex h-7 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--toolbar-background)] px-3 text-xs text-[var(--text-secondary)]">
    <div className="flex min-w-0 items-center gap-3"><span className="text-[var(--success)]">Система готова</span><span className="hidden sm:inline">Розділ: {currentPage}</span></div>
    <div className="flex shrink-0 items-center gap-3"><span>API: {apiState === 'available' ? 'доступний' : apiState === 'checking' ? 'перевірка' : 'недоступний'}</span><span className="hidden sm:inline">Версія: 0.1.0</span><span className="hidden max-w-[280px] truncate md:inline">Користувач: {userLabel}</span></div>
  </footer>;
}
