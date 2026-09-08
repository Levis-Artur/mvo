'use client';

import { useRouter } from 'next/navigation';
import { PatrolPoliceLogo } from '@/components/brand/patrol-police-logo';
import { Button, StatusBadge } from '@/components/ui';
import { roleLabels } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';

export type ApiState = 'checking' | 'available' | 'unavailable';

export function AppHeader({ apiState, user, onLogout }: { apiState: ApiState; user: AuthUser | null; onLogout: () => Promise<void> }) {
  const router = useRouter();
  const apiLabel = apiState === 'available' ? 'доступний' : apiState === 'checking' ? 'перевірка' : 'недоступний';
  const apiTone = apiState === 'available' ? 'success' : apiState === 'checking' ? 'warning' : 'danger';
  return <div className="app-topbar"><div className="app-topbar__inner">
    <div className="app-brand"><div className="app-brand__mark"><PatrolPoliceLogo className="app-brand__logo" /></div><span className="app-brand__title">Інформаційна система обліку майна</span></div>
    <div className="app-user"><span className="app-user__identity">{user ? `${user.username} · ${roleLabels[user.role]}` : ''}</span><span className="app-user__api"><StatusBadge dot tone={apiTone}>API: {apiLabel}</StatusBadge></span><Button aria-label="Посібник користувача" className="app-user__help" variant="ghost" type="button" onClick={() => router.push('/help')}>?<span className="app-user__help-label">Посібник користувача</span></Button><Button className="app-user__profile" icon="profile" variant="ghost" type="button" onClick={() => router.push('/profile')}>Профіль</Button><Button aria-label="Вийти" icon="logout" variant="ghost" type="button" onClick={() => { void onLogout().catch(() => undefined); }}>Вийти</Button></div>
  </div></div>;
}
