import type { ImportRowStatus, ImportStatus } from '@/lib/types';
import { StatusBadge } from '@/components/ui';
import {
  importRowStatusPresentation,
  importStatusPresentation,
} from './import-model';

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const value = importStatusPresentation(status);
  return <StatusBadge tone={value.tone}>{value.label}</StatusBadge>;
}

export function ImportRowStatusBadge({ status }: { status: ImportRowStatus }) {
  const value = importRowStatusPresentation(status);
  return <StatusBadge tone={value.tone}>{value.label}</StatusBadge>;
}
