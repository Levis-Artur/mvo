'use client';

import { useParams } from 'next/navigation';
import { ProtectedMvoApp } from '../../ui/protected-mvo-app';

export default function InventoryItemPage() {
  const params = useParams<{ id: string }>();
  return (
    <ProtectedMvoApp
      initialInventoryItemId={params.id}
      initialView="nomenclature"
    />
  );
}
