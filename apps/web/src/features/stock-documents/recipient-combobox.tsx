'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { TransferTarget } from '@/lib/types';
import {
  filterRecipientOptions,
  personOptionLabel,
} from './stock-document-rules';

export function RecipientCombobox({
  id,
  required,
  disabled,
  targets,
  sourceId,
  value,
  onChange,
}: {
  id?: string;
  required?: boolean;
  disabled: boolean;
  targets: TransferTarget[];
  sourceId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-options`;
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = targets.find((target) => target.id === value);
  const [query, setQuery] = useState(
    selected ? personOptionLabel(selected) : '',
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const options = filterRecipientOptions(targets, sourceId, query);

  useEffect(() => {
    if (!open) setQuery(selected ? personOptionLabel(selected) : '');
  }, [open, selected]);

  function select(target: TransferTarget) {
    onChange(target.id);
    setQuery(personOptionLabel(target));
    setOpen(false);
  }

  return (
    <div
      className="recipient-combobox"
      ref={containerRef}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <Input
        aria-activedescendant={
          open && options[activeIndex]
            ? `${listboxId}-${options[activeIndex].id}`
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
        id={inputId}
        placeholder="Введіть номер, ПІБ або управління"
        required={required}
        role="combobox"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
          if (value) onChange('');
        }}
        onFocus={() => {
          setQuery('');
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) =>
              Math.min(current + 1, Math.max(options.length - 1, 0)),
            );
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter' && open && options[activeIndex]) {
            event.preventDefault();
            select(options[activeIndex]);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open && !disabled ? (
        <div
          aria-label="Активні МВО-одержувачі"
          className="recipient-combobox__list compact-scrollbar"
          id={listboxId}
          role="listbox"
        >
          {options.length ? (
            options.map((target, index) => (
              <Button
                aria-selected={target.id === value}
                className="recipient-combobox__option"
                data-active={index === activeIndex ? 'true' : undefined}
                id={`${listboxId}-${target.id}`}
                key={target.id}
                role="option"
                size="compact"
                type="button"
                variant="ghost"
                onClick={() => select(target)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <strong>
                  {target.personnelNumber} — {target.fullName}
                </strong>
                <span>{target.management?.name ?? 'Без управління'}</span>
              </Button>
            ))
          ) : (
            <p className="recipient-combobox__empty">
              Активних МВО не знайдено
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
