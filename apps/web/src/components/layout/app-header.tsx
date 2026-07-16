'use client';

import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToolbarActions, roleLabels, type NavigationItem, type ToolbarActionConfig } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';
import { useAuth } from '@/app/ui/auth-context';
import { emitToolbarAction, type View } from './toolbar-events';

const UNIMPLEMENTED_TITLE = 'Функція ще не реалізована';

export function AppHeader({ apiState, currentView, navigationItems, topNavRef, user, onLogout, onSelectView }: { apiState: 'checking' | 'available' | 'unavailable'; currentView: View; navigationItems: NavigationItem[]; topNavRef: RefObject<HTMLElement | null>; user: AuthUser | null; onLogout: () => Promise<void>; onSelectView: (view: View) => void }) {
  const router = useRouter();
  return <header className="border-b border-[var(--border)] bg-[var(--surface)]">
    <div className="flex h-10 items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-center gap-2"><div className="grid h-6 w-8 place-items-center rounded border border-[var(--border)] bg-[var(--toolbar-background)] text-[11px] font-semibold text-[var(--primary)]">MVO</div><p className="truncate text-sm font-semibold">Облік майна МВО</p></div>
      <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-secondary)] sm:gap-3">
        <span className="hidden max-w-[260px] truncate sm:inline">{user ? `${user.username} · ${roleLabels[user.role]}` : ''}</span>
        <span className={apiState === 'available' ? 'text-[var(--success)]' : apiState === 'checking' ? 'text-[var(--warning)]' : 'text-[var(--danger)]'}>API: {apiState === 'available' ? 'доступний' : apiState === 'checking' ? 'перевірка' : 'недоступний'}</span>
        <button className="btn btn-ghost !min-h-7 !w-auto !px-2 disabled:cursor-not-allowed disabled:opacity-55" type="button" onClick={() => router.push('/profile')}>Профіль</button>
        <button className="btn btn-outline !min-h-7 !w-auto !px-2" type="button" onClick={() => { void onLogout(); }}>Вийти</button>
      </div>
    </div>
    <nav ref={topNavRef} className="compact-scrollbar flex h-9 items-end gap-1 overflow-x-auto whitespace-nowrap border-t border-[var(--border-light)] bg-[var(--toolbar-background)] px-2 text-sm">
      {navigationItems.map((item) => <TopNavButton key={item.label} item={item} active={item.view === currentView} onSelect={onSelectView} />)}
    </nav>
    <PageToolbar currentView={currentView} />
  </header>;
}

function TopNavButton({ item, active, onSelect }: { item: NavigationItem; active: boolean; onSelect: (view: View) => void }) {
  return <button className={`h-9 shrink-0 border px-3 text-[13px] transition ${active ? 'border-[var(--border)] border-b-[var(--workspace-background)] bg-[var(--workspace-background)] font-semibold text-[var(--text-primary)]' : item.disabled ? 'cursor-not-allowed border-transparent bg-transparent text-[var(--text-muted)]' : 'border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'}`} data-active={active ? 'true' : undefined} disabled={item.disabled} title={item.disabled ? (item.title ?? UNIMPLEMENTED_TITLE) : undefined} type="button" onClick={() => { if (!item.disabled) onSelect(item.view); }}>{item.label}</button>;
}

function PageToolbar({ currentView }: { currentView: View }) {
  const { user } = useAuth();
  const actions = getToolbarActions(user, currentView);
  const [open, setOpen] = useState(false);
  useEffect(() => { const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown); }, []);
  return <div className="relative border-t border-[var(--border-light)] bg-[var(--toolbar-background)] px-2 py-1">
    <div className="hidden min-h-9 items-center gap-1 overflow-x-auto sm:flex">{actions.map((action) => <ToolbarButton key={action.label} action={action} currentView={currentView} />)}</div>
    <div className="sm:hidden"><button className="btn btn-outline !min-h-7 !w-auto" type="button" onClick={() => setOpen((value) => !value)}>Дії</button>{open ? <div className="absolute left-2 right-2 top-[calc(100%-0.25rem)] z-40 grid gap-1 rounded-md border border-[var(--border)] bg-white p-1 shadow-lg">{actions.map((action) => <ToolbarButton key={action.label} action={action} currentView={currentView} onDone={() => setOpen(false)} />)}</div> : null}</div>
  </div>;
}

function ToolbarButton({ action, currentView, onDone }: { action: ToolbarActionConfig; currentView: View; onDone?: () => void }) {
  return <button className={`${action.primary ? 'btn btn-primary' : 'btn btn-outline'} !min-h-7 !w-auto disabled:cursor-not-allowed disabled:opacity-55`} disabled={action.disabled} title={action.disabled ? (action.title ?? UNIMPLEMENTED_TITLE) : action.title} type="button" onClick={() => { if (action.id) { emitToolbarAction(currentView, action.id); onDone?.(); } }}>{action.label}</button>;
}
