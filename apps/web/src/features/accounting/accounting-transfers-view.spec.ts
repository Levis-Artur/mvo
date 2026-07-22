import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { can, getNavigationItems } from '../../lib/authz';
import type { AuthUser } from '../../lib/types';

const user = (role: AuthUser['role']) => ({
  id: role,
  username: role,
  role,
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: role === 'MVO' ? 'person-1' : null,
}) as AuthUser;

describe('AccountingTransfersView', () => {
  const view = readFileSync(join(__dirname, 'accounting-transfers-view.tsx'), 'utf8');
  const client = readFileSync(join(__dirname, '../../lib/api-client.ts'), 'utf8');

  it.each(['ACCOUNTANT', 'OWNER', 'DPP_ADMIN', 'AUDITOR'] as const)(
    'shows the accounting register to %s',
    (role) => {
      expect(can(user(role), 'read', 'accountingTransfers')).toBe(true);
      expect(getNavigationItems(user(role)).some((item) => item.href === '/accounting/mvo-transfers')).toBe(true);
    },
  );

  it('does not expose the accounting register to MVO', () => {
    expect(can(user('MVO'), 'read', 'accountingTransfers')).toBe(false);
    expect(getNavigationItems(user('MVO')).some((item) => item.href === '/accounting/mvo-transfers')).toBe(false);
  });

  it('renders all required filters, register columns and export history', () => {
    for (const label of [
      'Відправник', 'Одержувач', 'Показати документи, що містять номенклатуру', 'Статус', 'Номер документа',
      'Номер документа', 'МВО-відправник', 'МВО-одержувач', 'Кількість',
      'Дата проведення', 'Історія експортів',
    ]) expect(view).toContain(label);
    expect(view).toContain('dateFrom={draft.dateFrom}');
    expect(view).toContain('dateTo={draft.dateTo}');
    expect(view).toContain('Завантажити повторно');
    expect(view).toContain("router.push('/accounting/mvo-transfers/exports')");
  });

  it('keeps the document-level nomenclature filter operable by mouse and keyboard', () => {
    expect(view).toContain(
      '<FilterField label="Показати документи, що містять номенклатуру"><Select',
    );
    expect(view).toContain('value={draft.inventoryItemId}');
    expect(view).toContain('onChange={(event) => setDraft');
    expect(readFileSync(join(__dirname, '../../components/ui/select.tsx'), 'utf8'))
      .toContain('<select');
  });

  it('uses dedicated accounting endpoints and never requests a page limit above 100', () => {
    expect(client).toContain("'/accounting/mvo-transfers'");
    expect(client).toContain("'/accounting/mvo-transfers/export.csv'");
    expect(client).toContain("'/accounting/mvo-transfer-exports'");
    expect(view).toContain('limit: Math.min(limit, 100)');
  });

  it('does not render UUIDs and explains that export does not link imports', () => {
    expect(view).not.toContain('row.documentId');
    expect(view).not.toContain('row.documentNumber');
    expect(view).not.toContain('batch.sha256');
    expect(view).toContain('documentNumberLabel(row.displayNumber)');
    expect(view).toContain('не пов’язує передачі з імпортами');
  });

  it('creates exports without unsafe status or export-state filters', () => {
    const exportMapper = view.slice(
      view.indexOf('function toExportFilters'),
      view.indexOf('function formatDate'),
    );
    expect(exportMapper).not.toContain('status:');
    expect(exportMapper).not.toContain('exportState:');
    expect(view).toContain("user && user.role !== 'AUDITOR'");
  });

  it('shows exported transfers as sent to accounting', () => {
    expect(view).toContain('Передано бухгалтерії');
    expect(view).toContain("row.exportState === 'EXPORTED'");
  });
});
