'use client';
import { EmptyState as UiEmptyState, ErrorState, LoadingState, StatusBadge as UiStatusBadge, type StatusTone } from '@/components/ui';

export function StatusBadge({ active }: { active: boolean }) { return <UiStatusBadge dot tone={active ? 'success' : 'neutral'}>{active ? 'Активний' : 'Неактивний'}</UiStatusBadge>; }
export function StatusPill({ status }: { status: string }) { const normalized = status.toLowerCase(); const tone: StatusTone = normalized.includes('error') || normalized.includes('failed') || normalized.includes('cancel') || normalized.includes('помил') || normalized.includes('скас') ? 'danger' : normalized.includes('warning') || normalized.includes('partial') || normalized.includes('draft') || normalized.includes('чернет') ? 'warning' : normalized.includes('completed') || normalized.includes('valid') || normalized.includes('posted') || normalized.includes('проведен') || normalized.includes('успіш') ? 'success' : normalized.includes('uploaded') ? 'info' : 'neutral'; return <UiStatusBadge tone={tone}>{status}</UiStatusBadge>; }
export function Alert({ tone, title, message }: { tone: StatusTone; title: string; message: string }) { return <div className="ui-alert" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}><strong>{title}</strong><span>{message}</span></div>; }
export function LoadingMessage() { return <LoadingState />; }
export function ErrorMessage({ message }: { message: string }) { return <ErrorState message={message} />; }
export function EmptyState({ message }: { message: string }) { return <UiEmptyState message={message} />; }
