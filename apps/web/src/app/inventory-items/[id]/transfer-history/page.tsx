'use client';

import { useParams } from 'next/navigation';
import { ProtectedMvoApp } from '../../../ui/protected-mvo-app';

export default function InventoryItemTransferHistoryPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedMvoApp
      initialInventoryTransferHistoryId={params.id}
      initialView="nomenclature"
    />
  );
}
