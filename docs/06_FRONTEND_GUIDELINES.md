# Frontend Development Guidelines

Version: 2.0

## Призначення

Цей документ визначає UI/UX та архітектурні правила frontend для MVO Inventory Management System. Інтерфейс має бути офіційним, передбачуваним, компактним, доступним із клавіатури та придатним для екранів від 360 px.

Frontend відповідає за відображення даних, локальний UI state і виклики Backend API. Бізнес-рішення, авторизація та остаточна перевірка прав залишаються на backend.

## Стек і структура

- Next.js App Router;
- React;
- TypeScript;
- CSS design tokens і Tailwind utility classes;
- спільний типізований `api-client`.

Рекомендована структура:

```text
src/
  app/
  components/
    auth/
    layout/
    ui/
  features/
  lib/
  styles/
    tokens.css
    components.css
    layout.css
    responsive.css
```

Компонент має виконувати одну логічну задачу. Рекомендований розмір — до 300 рядків, максимально допустимий без обґрунтування — приблизно 400 рядків.

## Design tokens

Єдиним джерелом базових значень є `src/styles/tokens.css`.

У tokens визначаються:

- шрифти та розміри тексту;
- відступи;
- радіуси;
- висота контролів;
- тіні;
- основні, фонові та текстові кольори;
- success, warning, danger та info кольори;
- focus ring;
- overlay;
- контрольні viewport: 360, 768, 1024, 1440 і 1920 px.

Заборонено додавати `#hex`, `rgb()`, `hsl()`, `text-red-*`, `bg-white` або інші локальні кольори поза `tokens.css`. Для нового кольору спочатку створюється семантичний token.

Правильно:

```tsx
<p className="text-[var(--color-text-secondary)]">Допоміжний текст</p>
```

Неправильно:

```tsx
<p className="text-slate-500">Допоміжний текст</p>
```

## Layout

Усі захищені робочі сторінки використовують `AppShell`, який містить:

- `AppHeader`;
- `MainNavigation`;
- `PageContainer`;
- `StatusFooter`.

Кожен feature view починається з `PageHeader`. Основні дії сторінки розташовуються у `PageHeader`; окрема дубльована toolbar не створюється.

```tsx
<section className="grid min-w-0 gap-4">
  <PageHeader
    title="Номенклатура"
    description="Довідник майна."
    action={<Button onClick={openForm}>Додати</Button>}
  />
  {content}
</section>
```

Для контейнерів у grid/flex обов’язково враховувати `min-w-0`. Контент не повинен збільшувати ширину viewport.

## Базові компоненти

Повторюваний UI використовує компоненти з `components/ui`:

- `Button`;
- `Card`;
- `DataTable`;
- `FilterBar`;
- `FormField`, `Input`, `Select`, `Textarea`, `Checkbox`;
- `Modal` і `ConfirmationDialog`;
- `Pagination`;
- `StatusBadge`;
- `LoadingState`, `EmptyState`, `ErrorState`;
- `Toast`.

Нативні `<button>` поза реалізацією `Button` заборонені. Для кнопки, що виглядає як текстове посилання, використовується `variant="link"`.

## Таблиці

Feature-компоненти не створюють власні HTML tables. Використовується `DataTable`.

Обов’язкові правила:

- `ariaLabel` описує призначення таблиці;
- числові колонки мають `numeric: true`;
- статуси відображаються через `StatusBadge`;
- остання колонка дій має `actions: true`;
- loading та empty передаються у `DataTable`;
- horizontal scroll залишається всередині `.data-table-scroll`;
- великі набори даних мають `Pagination`;
- API limit — лише 20, 50 або 100.

```tsx
<DataTable
  ariaLabel="Залишки МВО"
  columns={[
    { label: 'Номенклатура' },
    { label: 'Кількість', numeric: true },
    { label: 'Статус' },
    { label: 'Дії', actions: true },
  ]}
  loading={loading}
  emptyMessage="Залишків немає."
  rows={rows}
/>
```

## Фільтри й пагінація

Фільтри використовують `FilterBar`. Draft state не повинен автоматично запускати API-запит на кожен render. Запит виконується після «Застосувати», «Очистити» або «Оновити».

Для завантаження всіх сторінок використовується `fetchAllPages`, який:

- запитує `limit=100`;
- не допускає нескінченного циклу;
- об’єднує записи без дублікатів за `id`.

Ніколи не передавати API `limit > 100`.

## Форми

Кожен control повинен мати видимий `label` через `FormField` або точний `aria-label`, якщо поле знаходиться всередині рядка таблиці.

Форма повинна:

- використовувати типізований state;
- позначати required fields;
- показувати field error біля відповідного поля;
- показувати загальну API error через `ErrorState`;
- блокувати повторне submit;
- показувати loading-текст кнопки;
- підтримувати disabled і read-only state;
- використовувати `autoComplete`, де це доречно.

```tsx
<FormField label="Логін" error={fieldError} required>
  <Input
    autoComplete="username"
    disabled={saving}
    value={username}
    onChange={(event) => setUsername(event.target.value)}
  />
</FormField>
```

## Modal і confirmation

Усі діалоги використовують спільний `Modal`.

Він забезпечує:

- `role="dialog"` та `aria-modal`;
- focus trap;
- закриття через Escape, якщо операція не критична;
- повернення focus на opener;
- scrollable body;
- фіксований footer;
- mobile width;
- destructive style.

Заборонено:

- `alert()`, `confirm()` і `prompt()`;
- custom backdrop у feature-компоненті;
- відкривати modal поверх іншого modal.

Перед переходом із details до edit/delete поточний modal спочатку закривається. Destructive actions завжди показують server blockers і typed confirmation.

```tsx
<Modal
  destructive
  closeOnEscape={!saving}
  title="Підтвердження видалення"
  footer={actions}
  onClose={onClose}
>
  {error ? <ErrorState message={error} /> : content}
</Modal>
```

## Loading, empty, error і success

Кожен запит повинен мати видимий стан:

- `LoadingState` під час запиту;
- `EmptyState`, якщо набір порожній;
- `ErrorState` при помилці;
- `Toast` або success alert після успішної mutation.

Не можна показувати користувачу `Failed to fetch`, `Internal Server Error`, stack trace або інші технічні англомовні повідомлення. Стандартизоване повідомлення API українською має пріоритет; network errors перетворюються на безпечний український текст.

Promise, який може бути rejected, повинен бути `await` у `try/catch` або мати `.catch()`. `void promise` без гарантованої внутрішньої обробки помилки заборонено.

## Responsive

Контрольні viewport для перевірки: 360, 768, 1024, 1440 і 1920 px.

- до 899 px layout переходить в одну колонку;
- navigation має власний horizontal scroll;
- FilterBar і modal actions стають вертикальними;
- forms переходять в одну колонку;
- DataTable прокручується тільки у своєму контейнері;
- footer приховує другорядні дані;
- на 360 px зберігаються дії «Профіль» і «Вийти», а другорядний API badge може бути прихований;
- від 1280 px dashboard використовує три колонки;
- на широких екранах контент обмежується `--content-max` і центрується.

Заборонено визначати layout через `window.innerWidth` у JavaScript. Використовуються CSS media queries.

## Accessibility

Обов’язково:

- semantic HTML;
- видимий `:focus-visible` із контрастом не нижче 3:1;
- клавіатурна активація інтерактивних rows через Enter і Space;
- `aria-current="page"` для активної навігації;
- `aria-label` для icon-only buttons і таблиць;
- label для form controls;
- `aria-invalid` і `role="alert"` для помилок;
- достатній контраст тексту за WCAG AA;
- підтримка `prefers-reduced-motion`.

Колір не може бути єдиним способом передавання стану: badge завжди містить текст.

## Routing і authorization

URL і role-based navigation визначаються централізовано. Frontend приховує недоступні дії, але backend залишається остаточним джерелом прав.

- OWNER бачить повне адміністрування;
- DPP_ADMIN керує дозволеними довідниками та користувачами МВО;
- AUDITOR працює read-only;
- MVO бачить лише власні дані та дозволені документи.

Не створювати локальні перевірки ролей, якщо вже існують `can()`, navigation model або feature presentation model.

## API

Feature-компоненти працюють через service та спільний `api-client`. Прямий `fetch()` у feature-компонентах заборонений, крім централізованої перевірки health у shell.

Не змінювати API contracts у межах UI-задачі. Не показувати password hashes, session tokens або внутрішні поля.

## Testing і Definition of Done

Перевіряються:

- role-based routes і read-only режим;
- loading, empty, error та success states;
- modal focus і typed confirmation;
- keyboard navigation;
- limit не більше 100;
- відсутність browser dialogs;
- відсутність mojibake;
- responsive/reduced-motion invariants.

Перед завершенням:

```text
npm run lint
npm run build
npm test --workspace apps/web
npm test --workspace apps/api
```

Завдання завершене лише після успішних lint, build, tests, перевірки документації та `git diff --check`.
