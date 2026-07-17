'use client';

import { useRouter } from 'next/navigation';
import { Button, Icon, StatusBadge } from '@/components/ui';
import { roleLabels } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';

export type ApiState = 'checking' | 'available' | 'unavailable';

export function AppHeader({ apiState, user, onLogout }: { apiState: ApiState; user: AuthUser | null; onLogout: () => Promise<void> }) {
  const router = useRouter();
  const apiLabel = apiState === 'available' ? 'доступний' : apiState === 'checking' ? 'перевірка' : 'недоступний';
  const apiTone = apiState === 'available' ? 'success' : apiState === 'checking' ? 'warning' : 'danger';
  return <div className="app-topbar"><div className="app-topbar__inner">
    <div className="app-brand"><div className="app-brand__mark" aria-label="Державний знак"><Icon name="shield" height="32" width="32" /></div><span className="app-brand__badge">МВО</span><span className="app-brand__title">Облік майна МВО</span></div>
    <div className="app-user"><span className="app-user__identity">{user ? `${user.username} · ${roleLabels[user.role]}` : ''}</span><StatusBadge dot tone={apiTone}>API: {apiLabel}</StatusBadge><Button className="app-user__profile" icon="profile" variant="ghost" type="button" onClick={() => router.push('/profile')}>Профіль</Button><Button aria-label="Вийти" icon="logout" variant="ghost" type="button" onClick={() => void onLogout()}>Вийти</Button></div>
  </div></div>;
}
