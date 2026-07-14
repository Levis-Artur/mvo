'use client';

import { useParams } from 'next/navigation';
import { ProtectedMvoApp } from '../../ui/protected-mvo-app';

export default function ImportPreviewPage() {
  const params = useParams<{ id: string }>();

  return <ProtectedMvoApp initialView="imports" initialImportId={params.id} />;
}
