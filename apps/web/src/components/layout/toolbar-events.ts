'use client';

import type { AppView, ToolbarActionId } from '@/lib/authz';

export type View = AppView;
type ToolbarEventDetail = { view: View; action: ToolbarActionId };

export const TOOLBAR_EVENT = 'mvo:toolbar-action';

export function emitToolbarAction(view: View, action: ToolbarActionId) {
  window.dispatchEvent(new CustomEvent<ToolbarEventDetail>(TOOLBAR_EVENT, { detail: { view, action } }));
}

export function getToolbarDetail(event: Event) {
  if (!(event instanceof CustomEvent)) return null;
  return event.detail as ToolbarEventDetail;
}

export function focusFirstField() {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>('main input, main select');
  field?.focus();
}
