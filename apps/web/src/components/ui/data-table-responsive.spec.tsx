/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from './data-table';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PageHeader } from '@/components/layout/page-header';
import { FilterBar } from './filter-bar';
import { ErrorState } from './error-state';

afterEach(cleanup);

describe('DataTable responsive structure', () => {
  it('uses natural page height by default and exposes labels for card layout', () => {
    render(
      <DataTable
        ariaLabel="Майно"
        columns={[{ label: 'Код' }, { label: 'Назва' }]}
        responsiveMode="cards"
        rows={[['001', 'Клавіатура']]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Майно' });
    const wrapper = table.parentElement;
    expect(wrapper?.getAttribute('data-scroll-mode')).toBe('natural');
    expect(wrapper?.classList.contains('compact-scrollbar')).toBe(false);
    expect(table.getAttribute('data-responsive')).toBe('cards');
    expect(screen.getByText('Клавіатура').closest('td')?.dataset.label).toBe(
      'Назва',
    );
  });

  it('enables explicit horizontal scroll styling when requested', () => {
    render(
      <DataTable
        ariaLabel="Широкий реєстр"
        columns={[{ label: 'Поле' }]}
        rows={[['Значення']]}
        scrollMode="horizontal"
      />,
    );

    const wrapper = screen.getByRole('table').parentElement;
    expect(wrapper?.getAttribute('data-scroll-mode')).toBe('horizontal');
    expect(wrapper?.classList.contains('compact-scrollbar')).toBe(true);
  });

  it('contains natural table overflow and wraps cells, filters and modal actions', () => {
    const css = readFileSync(join(__dirname, '../../styles/components.css'), 'utf8');
    const responsive = readFileSync(join(__dirname, '../../styles/responsive.css'), 'utf8');
    expect(css).toMatch(/\.data-table-scroll \{[^}]*min-width: 0;[^}]*overflow-x: auto;/);
    expect(css).toMatch(/\.data-table td \{[^}]*overflow-wrap: anywhere;[^}]*white-space: normal;/);
    expect(css).toMatch(/\.filter-bar \{[^}]*flex-wrap: wrap;/);
    expect(css).toMatch(/\.filter-bar__actions \{[^}]*flex-wrap: wrap;/);
    expect(css).toMatch(/\.ui-modal__header, \.ui-modal__footer \{[^}]*position: static;/);
    expect(css).toMatch(/\.ui-alert, \.ui-state, \.data-table-state \{[^}]*overflow-wrap: anywhere;/);
    expect(responsive).toMatch(/\.ui-toast \{[^}]*position: fixed;[^}]*max-height: 25dvh;[^}]*pointer-events: none;/);
    expect(responsive).toMatch(/\.ui-toast > \.btn \{[^}]*pointer-events: auto;/);
  });

  it('keeps dynamic errors between the header and table without losing row actions', () => {
    const onRowClick = jest.fn();
    const view = (error: boolean) => <section className="grid min-w-0 gap-3">
      <PageHeader title="Довгий заголовок" description="Робочий перегляд" />
      <FilterBar onApply={jest.fn()} onReset={jest.fn()} onRefresh={jest.fn()} />
      {error ? <ErrorState message="Довге повідомлення про помилку" /> : null}
      <DataTable ariaLabel="Майно" columns={[{ label: 'Номенклатура' }]}
        rows={[[ 'ДовгаНазваБезПробілів'.repeat(10) ]]} onRowClick={onRowClick} />
    </section>;
    const { rerender } = render(view(false));
    rerender(view(true));
    const state = screen.getByText('Довге повідомлення про помилку').closest('.ui-state');
    expect(state?.nextElementSibling?.classList.contains('data-table-shell')).toBe(true);
    expect(state?.getAttribute('style')).toBeNull();
    const cell = screen.getByRole('cell');
    expect(cell.classList.contains('min-w-0')).toBe(true);
    expect(cell.classList.contains('break-words')).toBe(true);
    fireEvent.click(cell.closest('tr')!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it('preserves mouse and keyboard row activation in responsive mode', () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        ariaLabel="Інтерактивний список"
        columns={[{ label: 'Назва' }]}
        responsiveMode="cards-wide"
        rows={[['Клавіатура']]}
        onRowClick={onRowClick}
      />,
    );

    const row = screen.getByRole('row', { name: 'Клавіатура' });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});
