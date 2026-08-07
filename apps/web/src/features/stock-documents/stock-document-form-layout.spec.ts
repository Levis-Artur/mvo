import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const form = readFileSync(join(__dirname, 'stock-document-form.tsx'), 'utf8');
const lines = readFileSync(join(__dirname, 'stock-document-lines.tsx'), 'utf8');
const recipientCombobox = readFileSync(
  join(__dirname, 'recipient-combobox.tsx'),
  'utf8',
);
const modal = readFileSync(
  join(__dirname, '../../components/ui/modal.tsx'),
  'utf8',
);
const componentsCss = readFileSync(
  join(__dirname, '../../styles/components.css'),
  'utf8',
);
const responsiveCss = readFileSync(
  join(__dirname, '../../styles/responsive.css'),
  'utf8',
);

describe('stock document workspace modal', () => {
  it('uses a near-fullscreen modal with a separately scrolling body', () => {
    expect(form).toContain('size="fullscreen"');
    expect(modal).toContain("'fullscreen'");
    expect(componentsCss).toContain(".ui-modal[data-size='fullscreen']");
    expect(componentsCss).toContain('width: 96vw');
    expect(componentsCss).toContain('height: 94dvh');
    expect(componentsCss).toContain('max-height: none');
    expect(componentsCss).toContain('overflow-x: hidden; overflow-y: auto');
    expect(modal).toContain("document.body.style.overflow = 'hidden'");
    expect(responsiveCss).toContain(
      ".ui-modal[data-size='fullscreen'] { width: 100vw; height: 100dvh",
    );
  });

  it('hides automatic fields for MVO and does not send a transfer basis', () => {
    expect(form).not.toContain('label="Номер"');
    expect(form).not.toContain('label="Пошук МВО"');
    expect(form).toContain("{user.role !== 'MVO' ? (");
    expect(form).toContain('<FormField label="МВО-відправник" required>');
    expect(form).toContain("type === 'MVO_TRANSFER' || createAndPostIssue");
    expect(form).toContain('{!transfer && !createAndPostIssue ? (');
    expect(form).toContain('<FormField label="Мета або підстава" required>');
    expect(form).toContain('<FormField label="Примітка">');
    expect(form).toContain(
      "? 'За потреби вкажіть призначення або додаткову інформацію'",
    );
  });

  it('uses one searchable recipient combobox and excludes the current MVO', () => {
    expect(form).toContain('<RecipientCombobox');
    expect(form).toContain('sourceId={sourceId}');
    expect(form).not.toContain('recipientSearch');
    expect(recipientCombobox).toContain('role="combobox"');
    expect(recipientCombobox).toContain('aria-autocomplete="list"');
    expect(recipientCombobox).toContain(
      'filterRecipientOptions(targets, sourceId, query)',
    );
    expect(recipientCombobox).toContain("event.key === 'ArrowDown'");
    expect(recipientCombobox).toContain("event.key === 'Enter'");
  });

  it('removes the step banner and duplicate review instructions', () => {
    expect(form).not.toContain('stock-document-steps');
    expect(form).not.toContain('Етапи заповнення документа');
    expect(form).not.toContain('stock-document-review-note');
    expect(componentsCss).not.toContain('.stock-document-steps');
    expect(componentsCss).not.toContain('.stock-document-review-note');
  });

  it('uses a full-width responsive details grid above the document workspace', () => {
    expect(form).toContain('className="stock-document-form-layout"');
    expect(form).toContain('<Card title="Основні реквізити">');
    expect(form).toContain('className="stock-document-form-workspace"');
    expect(componentsCss).toContain(
      '.stock-document-form-layout { display: grid; width: 100%; min-width: 0; grid-template-columns: minmax(0, 1fr)',
    );
    expect(componentsCss).toContain(
      'grid-template-columns: minmax(0, 0.6fr) minmax(0, 1.4fr) minmax(0, 1fr)',
    );
    expect(responsiveCss).toContain(
      '.stock-document-form-fields { grid-template-columns: minmax(0, 1fr); }',
    );
  });

  it('uses create-and-post actions for new transfers and issues', () => {
    expect(form).toContain('form="stock-document-form"');
    expect(form).toContain(
      "const createAndPostTransfer = transfer && !document;",
    );
    expect(form).toContain('{createAndPostTransfer');
    expect(form).toContain('Підтвердити передачу');
    expect(form).toContain('Передаємо…');
    expect(form).toContain("const createAndPostIssue = issue && !document;");
    expect(form).toContain('Підтвердити видачу');
    expect(form).toContain('Видаємо…');
    expect(form).toContain(
      "requireIssueBasis: !createAndPostIssue",
    );
    expect(form).toContain(
      'Для видачі додайте хоча б одне фото або скан накладної',
    );
    expect(form).toContain(
      'disabled={saving || loadingSources || loadingTargets}',
    );
    expect(form).toContain('onClick={requestClose}');
    expect(componentsCss).toContain(
      '.ui-modal__footer { position: sticky; bottom: 0;',
    );
  });

  it('uses responsive position columns without a forced table width', () => {
    expect(lines).toContain("className: 'stock-document-lines__code'");
    expect(lines).toContain("className: 'stock-document-lines__quantity'");
    expect(lines).toContain("className: 'stock-document-lines__actions'");
    expect(componentsCss).toContain(
      '.stock-document-lines-table { width: 100%; table-layout: fixed; }',
    );
    expect(lines).toContain('responsiveMode="cards-wide"');
    expect(componentsCss).not.toContain(
      '.stock-document-lines-table--issue { min-width:',
    );
    expect(componentsCss).toContain(
      '.stock-document-lines__name { width: auto; min-width: 0; }',
    );
    expect(lines).toContain("...(!transfer");
    expect(lines).toContain('title={current?.inventoryItem.name}');
  });

  it('keeps transfer guidance, source selection and issue attachments', () => {
    expect(form).toContain(
      'Після проведення кількість буде списана з вашого залишку.',
    );
    expect(form).toContain('<StockDocumentLines');
    expect(form).toContain("{type === 'ISSUE' ? (");
    expect(form).toContain('<StockDocumentAttachments');
    expect(lines).toContain("transfer ? 'Доступно' : 'Кількість на складі'");
    expect(lines).toContain(
      "transfer ? 'Кількість' : 'Кількість до видачі'",
    );
  });
});
