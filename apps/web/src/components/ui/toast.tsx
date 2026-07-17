'use client';
import { Button } from './button';
import { Icon } from './icons';
export type ToastTone = 'success' | 'error' | 'warning' | 'info';
export function Toast({ message, tone = 'success', onClose }: { message: string; tone?: ToastTone; onClose: () => void }) {
  const icon = tone === 'success' ? 'check' : tone === 'error' || tone === 'warning' ? 'warning' : 'journal';
  return <div aria-live="polite" className="ui-toast" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}><Icon name={icon} /><span>{message}</span><Button aria-label="Закрити повідомлення" variant="ghost" type="button" onClick={onClose}>×</Button></div>;
}
