'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/app/ui/auth-context';
import { Button } from '@/components/ui';
import { getToolbarActions, type AppView, type ToolbarActionConfig } from '@/lib/authz';
import { emitToolbarAction } from './toolbar-events';

export function PageToolbar({ currentView }: { currentView: AppView }) { const { user } = useAuth(); const actions = getToolbarActions(user, currentView); const [open, setOpen] = useState(false); useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []); if (!actions.length) return null; return <div className="page-toolbar"><div className="hidden min-h-9 items-center gap-1 overflow-x-auto sm:flex">{actions.map((action) => <ToolbarButton action={action} currentView={currentView} key={action.label} />)}</div><div className="sm:hidden"><Button variant="outline" type="button" onClick={() => setOpen((value) => !value)}>Дії</Button>{open ? <div className="absolute left-2 right-2 z-40 grid gap-1 border border-[var(--color-border)] bg-white p-2 shadow-lg">{actions.map((action) => <ToolbarButton action={action} currentView={currentView} key={action.label} onDone={() => setOpen(false)} />)}</div> : null}</div></div>; }
function ToolbarButton({ action, currentView, onDone }: { action: ToolbarActionConfig; currentView: AppView; onDone?: () => void }) { return <Button disabled={action.disabled} title={action.title} type="button" variant={action.primary ? 'primary' : 'outline'} onClick={() => { if (action.id) emitToolbarAction(currentView, action.id); onDone?.(); }}>{action.label}</Button>; }
