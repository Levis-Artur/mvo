'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  canAccessPath,
  getAccessRedirectPath,
  type AppView,
} from '@/lib/authz';
import { useAuth } from './auth-context';
import { MvoApp } from './mvo-app';
import { LoadingState } from '@/components/ui';

type ProtectedMvoAppProps = {
  initialView?: AppView;
  initialImportId?: string;
  initialAccountingTab?: 'register' | 'exports';
  initialInventoryItemId?: string;
};

export function ProtectedMvoApp(props: ProtectedMvoAppProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace('/login');
      return;
    }

    if (user.mustChangePassword && pathname !== '/change-password') {
      router.replace('/change-password');
      return;
    }

    if (!canAccessPath(user, pathname, props.initialView ?? 'home')) {
      router.replace(getAccessRedirectPath(user, props.initialView ?? 'home'));
    }
  }, [loading, pathname, props.initialView, router, user]);

  if (
    loading ||
    !user ||
    user.mustChangePassword ||
    !canAccessPath(user, pathname, props.initialView ?? 'home')
  ) {
    return <AuthLoadingState />;
  }

  return <MvoApp {...props} />;
}

export function AuthLoadingState() {
  return (
    <main className="auth-page">
      <LoadingState label="Перевірка сесії…" />
    </main>
  );
}
