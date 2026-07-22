'use client';
import { useEffect, useRef } from 'react';
import { Button } from './button';
import { trappedFocusIndex } from './modal-focus-model';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export type ModalSize = 'small' | 'medium' | 'large' | 'fullscreen';

export function Modal({ title, children, footer, onClose, size = 'medium', destructive = false, closeOnEscape = true }: {
  title: string; children: React.ReactNode; footer?: React.ReactNode; onClose: () => void;
  size?: ModalSize; destructive?: boolean; closeOnEscape?: boolean;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function keyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && closeOnEscape) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const currentIndex = focusable.findIndex((element) => element === document.activeElement);
      event.preventDefault();
      focusable[trappedFocusIndex(currentIndex < 0 ? 0 : currentIndex, focusable.length, event.shiftKey)]?.focus();
    }
    document.addEventListener('keydown', keyDown);
    return () => { document.removeEventListener('keydown', keyDown); document.body.style.overflow = previousBodyOverflow; previousFocus?.focus(); };
  }, [closeOnEscape, onClose]);
  return <div className="ui-modal-backdrop" role="presentation"><section aria-labelledby="ui-modal-title" aria-modal="true" className="ui-modal" data-destructive={destructive ? 'true' : undefined} data-size={size} ref={dialogRef} role="dialog" tabIndex={-1}>
    <header className="ui-modal__header"><h2 id="ui-modal-title">{title}</h2><Button aria-label="Закрити" variant="ghost" type="button" onClick={onClose}>×</Button></header>
    <div className="ui-modal__body">{children}</div>{footer ? <footer className="ui-modal__footer">{footer}</footer> : null}
  </section></div>;
}
