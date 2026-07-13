'use client';

import { useParams } from 'next/navigation';
import { MvoApp } from '../../ui/mvo-app';

export default function ImportPreviewPage() {
  const params = useParams<{ id: string }>();

  return <MvoApp initialView="imports" initialImportId={params.id} />;
}
