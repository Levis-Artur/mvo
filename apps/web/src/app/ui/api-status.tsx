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
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Стан API</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {isChecking
              ? 'Перевірка сервера'
              : isAvailable
                ? 'Сервер доступний'
                : 'Сервер недоступний'}
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-sm font-medium ${
            isChecking
              ? 'bg-slate-200 text-slate-700'
              : isAvailable
                ? 'bg-blue-900 text-white'
                : 'bg-red-50 text-red-700 ring-1 ring-red-200'
          }`}
        >
          {isChecking ? 'Очікування' : isAvailable ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
