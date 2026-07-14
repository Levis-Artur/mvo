'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  canAccessPath,
  getDefaultAppPath,
  type AppView,
} from '@/lib/authz';
import { useAuth } from './auth-context';
import { MvoApp } from './mvo-app';

type ProtectedMvoAppProps = {
  initialView?: AppView;
  initialImportId?: string;
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
      router.replace(getDefaultAppPath(user));
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
    <div className="grid min-h-screen place-items-center bg-[var(--app-background)] px-4 text-[var(--text-primary)]">
      <div className="app-card w-full max-w-sm p-5 text-center">
        <p className="text-sm font-semibold">Перевірка сесії</p>
        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          Зачекайте, будь ласка.
        </p>
      </div>
    </div>
  );
}
