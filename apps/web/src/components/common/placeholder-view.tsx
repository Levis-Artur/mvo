'use client';

import { EmptyState, PageHeader } from '@/components/common';

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

