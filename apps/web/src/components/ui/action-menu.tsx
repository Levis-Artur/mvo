'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from './button';

export type ActionMenuItem = {
  key: string;
  label: ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

type MenuPosition = { top: number; left: number };

export function ActionMenu({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: ActionMenuItem[];
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
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 36 + 16;
    const viewportMargin = 8;
    const preferredTop = rect.bottom + 4;
    setPosition({
      top:
        preferredTop + menuHeight <= window.innerHeight - viewportMargin
          ? preferredTop
          : Math.max(viewportMargin, rect.top - menuHeight - 4),
      left: Math.max(
        viewportMargin,
        Math.min(
          rect.right - menuWidth,
          window.innerWidth - menuWidth - viewportMargin,
        ),
      ),
    });
  }, [items.length]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

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
      const menuItems = [
        ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
          []),
      ];
      if (!menuItems.length) return;
      event.preventDefault();
      const current = menuItems.indexOf(document.activeElement as HTMLElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      menuItems[(current + delta + menuItems.length) % menuItems.length]?.focus();
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

  if (!items.length) return null;

  return (
    <>
      <Button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="action-menu__trigger"
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
              aria-label={ariaLabel}
              className="action-menu"
              id={menuId}
              ref={menuRef}
              role="menu"
              style={position}
            >
              {items.map((item) => (
                <div
                  className={item.danger ? 'action-menu__danger' : undefined}
                  key={item.key}
                >
                  <Button
                    className="action-menu__item"
                    role="menuitem"
                    size="compact"
                    type="button"
                    variant={item.danger ? 'danger' : 'ghost'}
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                  >
                    {item.label}
                  </Button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
