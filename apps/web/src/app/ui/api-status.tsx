'use client';

import { useEffect, useState } from 'react';

type ApiState = 'checking' | 'available' | 'unavailable';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export function ApiStatus() {
  const [state, setState] = useState<ApiState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      try {
        const response = await fetch(`${apiUrl}/health`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          setState('unavailable');
          return;
        }

        const data = (await response.json()) as {
          status?: string;
          service?: string;
        };

        setState(
          data.status === 'ok' && data.service === 'mvo-inventory-api'
            ? 'available'
            : 'unavailable',
        );
      } catch {
        if (!controller.signal.aborted) {
          setState('unavailable');
        }
      }
    }

    void checkApi();

    return () => controller.abort();
  }, []);

  const isAvailable = state === 'available';
  const isChecking = state === 'checking';

  return (
    <div className="app-card bg-[var(--surface-muted)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            Стан API
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {isChecking
              ? 'Перевірка сервера'
              : isAvailable
                ? 'Сервер доступний'
                : 'Сервер недоступний'}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-medium ${
            isChecking
              ? 'border-slate-200 bg-white text-[var(--text-secondary)]'
              : isAvailable
                ? 'border-green-700/15 bg-green-50 text-[var(--success)]'
                : 'border-red-700/15 bg-red-50 text-[var(--danger)]'
          }`}
        >
          {isChecking ? 'Очікування' : isAvailable ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
