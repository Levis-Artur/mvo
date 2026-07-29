'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import type { ResponsiblePerson } from '@/lib/types';
import { personDisplayName } from './persons-model';

type MenuPosition = { top: number; left: number };

export function PersonActionsMenu({
  person,
  canEdit,
  canCreateAccount,
  canDelete,
  onView,
  onEdit,
  onCreateAccount,
  onDelete,
  onToggleActive,
}: {
  person: ResponsiblePerson;
  canEdit: boolean;
  canCreateAccount: boolean;
  canDelete: boolean;
  onView: () => void;
  onEdit: () => void;
  onCreateAccount: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}) {
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 224;
    const menuHeight = menuRef.current?.offsetHeight ?? 260;
    const viewportMargin = 8;
    const preferredTop = rect.bottom + 4;
    setPosition({
      top:
        preferredTop + menuHeight <= window.innerHeight - viewportMargin
          ? preferredTop
          : Math.max(viewportMargin, rect.top - menuHeight - 4),
      left: Math.max(
        viewportMargin,
        Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - viewportMargin),
      ),
    });
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  function invoke(action: () => void) {
    close();
    action();
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = [
        ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
      ];
      if (!items.length) return;
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      items[(current + delta + items.length) % items.length]?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [close, open, updatePosition]);

  return (
    <>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Дії для МВО ${personDisplayName(person)}`}
        className="person-actions-menu__trigger"
        ref={buttonRef}
        size="compact"
        type="button"
        variant="ghost"
        onClick={() => {
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
      >
        <span aria-hidden="true">⋮</span>
      </Button>
      {open
        ? createPortal(
            <div
              aria-label={`Дії для МВО ${personDisplayName(person)}`}
              className="person-actions-menu"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={position}
            >
              <MenuItem onSelect={() => invoke(onView)}>Переглянути</MenuItem>
              {canEdit ? (
                <MenuItem onSelect={() => invoke(onEdit)}>Редагувати</MenuItem>
              ) : null}
              {canCreateAccount ? (
                <MenuItem onSelect={() => invoke(onCreateAccount)}>
                  Створити обліковий запис
                </MenuItem>
              ) : null}
              {canEdit ? (
                <MenuItem onSelect={() => invoke(onToggleActive)}>
                  {person.isActive ? 'Деактивувати' : 'Активувати'}
                </MenuItem>
              ) : null}
              {canEdit ? (
                <MenuItem onSelect={() => invoke(onEdit)}>Перемістити</MenuItem>
              ) : null}
              {canDelete ? (
                <div className="person-actions-menu__danger">
                  <MenuItem danger onSelect={() => invoke(onDelete)}>
                    Видалити
                  </MenuItem>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function MenuItem({
  children,
  danger = false,
  onSelect,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      className="person-actions-menu__item"
      role="menuitem"
      size="compact"
      type="button"
      variant={danger ? 'danger' : 'ghost'}
      onClick={onSelect}
    >
      {children}
    </Button>
  );
}
