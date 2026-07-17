'use client';

import { EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/layout/page-header';

export function PlaceholderView({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="grid gap-3">
      <PageHeader title={title} description={description} />
      <EmptyState message={description} />
    </section>
  );
}

