# Система обліку майна МВО

Початковий монорепозиторій для централізованого обліку майна матеріально відповідальних осіб.

## Стек

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- База даних: PostgreSQL
- ORM: Prisma
- Локальний запуск PostgreSQL: Docker Compose
- Пакетний менеджер: npm

## Поточна функціональність

- Організаційна структура: управління, служби, підрозділи
- Реєстр матеріально відповідальних осіб
- Централізований довідник номенклатури
- Імпорт початкових залишків і нових надходжень із tab-separated CSV/TSV
- Поточні залишки за МВО та журнал операцій
- Ручне надходження майна
- Деактивація та повторна активація записів через `isActive`
- Dashboard зі статистикою з backend
- Seed із демонстраційними даними без реальних персональних даних

## Що потрібно встановити

- Node.js 20 або новіший
- npm 10 або новіший
- Docker і Docker Compose

## Підготовка `.env`

Створіть файл `.env` у корені проєкту на основі прикладу:

```bash
cp .env.example .env
```

За потреби змініть значення змінних:

```env
DATABASE_URL="postgresql://mvo_user:CHANGE_ME@localhost:5432/mvo_inventory?schema=public"
POSTGRES_DB=mvo_inventory
POSTGRES_USER=mvo_user
POSTGRES_PASSWORD=CHANGE_ME
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001/api
CORS_ORIGIN=http://localhost:3000
```

`CORS_ORIGIN` має містити конкретну адресу frontend. Значення `*` не використовується.

## Запуск PostgreSQL

```bash
docker compose up -d postgres
```

Перевірити стан контейнера:

```bash
docker compose ps
```

## Встановлення залежностей

```bash
npm install
```

Після встановлення залежностей згенеруйте Prisma Client:

```bash
npm run prisma:generate
```

## Важливо про перенесення проєкту

Не копіюйте й не архівуйте `node_modules`, `.next` або `dist`. Це згенеровані каталоги, які створюються локально під конкретну операційну систему та середовище.

Після завантаження проєкту на іншому комп'ютері потрібно виконати:

```bash
npm install
```

Залежності, встановлені на macOS, не можна переносити як готовий `node_modules` на Linux. Нативні модулі, зокрема залежності збірки CSS, мають встановлюватися безпосередньо на цільовій системі.

## Міграції Prisma

Prisma schema налаштована для PostgreSQL і містить базові організаційні моделі:

- `Management`
- `Service`
- `Unit`
- `ResponsiblePerson`
- `InventoryItem`
- `StockBalance`
- `StockTransaction`
- `ImportBatch`
- `ImportRow`

Застосувати міграції:

```bash
npm run prisma:migrate
```

Запустити seed:

```bash
npm run prisma:seed
```

Seed ідемпотентний: повторний запуск оновлює демонстраційні записи, а не створює дублікати.

## Імпорт залишків і надходжень

Підтримуються файли `.csv` і `.tsv`. Реальні CSV-файли оборотної відомості можуть бути розділені табуляцією. Система визначає роздільник автоматично:

- tab
- `;`
- `,`

Підтримується кодування:

- UTF-8
- UTF-8 BOM
- Windows-1251

Для імпорту використовуються колонки:

- `Контрагент`
- `Номенклатура`
- `Найменування`
- `Кількість Дт`
- `Кількість кін.`
- `Од.вим.` за наявності

Спочатку колонки шукаються за нормалізованою назвою. Якщо назву не знайдено, використовується сумісність за позиціями колонок 5, 6, 7, 12 і 16.

### Режими імпорту

`INITIAL_BALANCE` — імпорт початкових залишків. Кількість береться з колонки `Кількість кін.`. Для одного МВО повторний початковий імпорт блокується, якщо вже є операція `INITIAL_BALANCE`.

`RECEIPT` — імпорт нових надходжень. Кількість береться з колонки `Кількість Дт`. Порожні та нульові значення пропускаються, від'ємні значення стають помилкою. Колонка `Кількість кін.` використовується тільки для контрольної звірки та не переписує системний залишок.

### Номенклатура

Позиції визначаються за `externalCode` із колонки `Номенклатура`. Код зберігається як string, без перетворення на number, щоб не втратити початкові нулі.

Якщо позиції немає в довіднику, під час preview вона позначається як нова, а створюється лише під час проведення імпорту. Автоматично створені позиції мають статус `NEEDS_REVIEW`.

Якщо код існує, але назва у файлі відрізняється, система використовує наявну позицію і додає warning для перевірки.

### Зіставлення МВО

МВО визначається за:

1. точним збігом `externalAccountingName`;
2. точним збігом `externalAccountingCode`, якщо код вдалося виділити;
3. ручним вибором адміністратора на preview.

Автоматичне зіставлення за прізвищем та ініціалами без підтвердження не використовується.

### Захист від повторів

Для кожного файлу рахується SHA-256 `fileHash`. Однаковий файл не можна завантажити повторно незалежно від назви.

Preview не змінює залишки. Залишки змінюються тільки після `Провести імпорт`; створення операцій і оновлення залишків виконуються транзакційно.

## Запуск застосунків

Запустити frontend і backend разом:

```bash
npm run dev
```

Запустити окремо frontend:

```bash
npm run dev:web
```

Запустити окремо backend:

```bash
npm run dev:api
```

## Адреси

- Frontend: http://localhost:3000
- Backend health endpoint: http://localhost:3001/api/health
- PostgreSQL: localhost:5432

## Перевірка API

```bash
curl http://localhost:3001/api/health
```

Очікувана відповідь:

```json
{
  "status": "ok",
  "service": "mvo-inventory-api"
}
```

### Формат помилок API

Усі помилки backend повертаються в єдиному JSON-форматі:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Людинозрозуміле повідомлення",
  "details": null,
  "path": "/api/...",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-07-16T10:00:00.000Z"
}
```

Клієнт може передати `X-Request-ID`, що містить до 128 латинських
літер, цифр або символів `._:-`. Для відсутнього чи некоректного значення
backend генерує UUID. Фактичний ідентифікатор завжди повертається в заголовку
`X-Request-ID` та полі `requestId`. Код `code` призначений для програмної
обробки, а `message` — для показу користувачу. Для validation errors поле
`details` містить масив окремих повідомлень.

Основні endpoints:

- `GET /api/dashboard/stats`
- `GET /api/managements`
- `GET /api/managements/:id`
- `POST /api/managements`
- `PATCH /api/managements/:id`
- `GET /api/services?managementId=...`
- `GET /api/services/:id`
- `POST /api/services`
- `PATCH /api/services/:id`
- `GET /api/units?managementId=...&serviceId=...`
- `GET /api/units/:id`
- `POST /api/units`
- `PATCH /api/units/:id`
- `GET /api/responsible-persons?search=...&page=1&limit=20`
- `GET /api/responsible-persons/:id`
- `GET /api/responsible-persons/:id/stock-balances`
- `GET /api/responsible-persons/:id/stock-transactions`
- `POST /api/responsible-persons`
- `PATCH /api/responsible-persons/:id`
- `GET /api/inventory-items`
- `GET /api/inventory-items/:id`
- `POST /api/inventory-items`
- `PATCH /api/inventory-items/:id`
- `GET /api/stock-balances`
- `GET /api/stock-balances/:id`
- `GET /api/stock-transactions`
- `GET /api/stock-transactions/:id`
- `POST /api/stock-transactions/manual-receipt`
- `POST /api/imports/upload`
- `GET /api/imports`
- `GET /api/imports/:id`
- `GET /api/imports/:id/rows`
- `PATCH /api/imports/:id/mappings`
- `POST /api/imports/:id/validate`
- `POST /api/imports/:id/commit`
- `POST /api/imports/:id/cancel`

HTTP DELETE endpoints на цьому етапі не використовуються.

## Production-розгортання на Debian або Ubuntu

Production-запуск виконується через Docker Compose зі сервісами PostgreSQL, API, Web і Nginx. Публічним є лише Nginx, який проксує `/api/` на backend і всі інші запити на frontend.

### Підготовка сервера

На чистому Debian або Ubuntu сервері виконайте:

```bash
git clone https://github.com/Levis-Artur/mvo.git
cd mvo
cp .env.example .env
nano .env
chmod +x setup-server.sh deploy.sh update.sh status.sh logs.sh backup.sh restore.sh
./setup-server.sh
```

У файлі `.env` обов'язково замініть `POSTGRES_PASSWORD=CHANGE_ME` на довгий випадковий пароль і встановіть коректний `CORS_ORIGIN`, наприклад `http://SERVER_IP`.

Після завершення `setup-server.sh` вийдіть із SSH-сесії та зайдіть повторно, щоб членство в групі `docker` застосувалося до вашого користувача.

### Перший запуск

Після повторного входу в SSH:

```bash
cd mvo
./deploy.sh
```

Скрипт перевіряє `.env`, Docker, production compose, будує images, запускає PostgreSQL, виконує `prisma migrate deploy`, запускає всі сервіси й перевіряє API через Nginx.

### Оновлення

```bash
./update.sh
```

`update.sh` вимагає чистий git working tree, виконує `git pull --ff-only origin main`, перебудовує production images, застосовує `prisma migrate deploy` і перезапускає сервіси. Скрипт не видаляє базу даних і не змінює серверний `.env`.

### Статус

```bash
./status.sh
```

Показує `docker compose ps`, health контейнерів, перевірку API та frontend через Nginx, `PUBLIC_PORT` і останні логи проблемних сервісів.

### Логи

```bash
./logs.sh
./logs.sh api
./logs.sh web
./logs.sh postgres
./logs.sh nginx
```

Без аргументів показує логи всіх production-сервісів. З аргументом дозволені тільки `api`, `web`, `postgres`, `nginx`.

### Backup

```bash
./backup.sh
```

Backup створюється у каталозі `backups` у форматі `mvo_YYYY-MM-DD_HH-MM-SS.sql.gz`. Якщо `BACKUP_RETENTION_DAYS` задано коректно, старі файли `mvo_*.sql.gz` видаляються лише всередині `backups`.

Backup-файли потрібно додатково копіювати на інший фізичний носій або інший сервер. Сам факт наявності backup на тому самому сервері не захищає від втрати сервера або диска.

### Restore

```bash
./restore.sh backups/НАЗВА_ФАЙЛУ.sql.gz
```

Перед restore скрипт перевіряє gzip-файл, показує цільову базу, вимагає точне підтвердження `RESTORE`, автоматично створює свіжий backup, тимчасово зупиняє API, відновлює PostgreSQL і запускає API назад.

### Важливо для production

- `.env` не зберігається в GitHub.
- `deploy.sh` не запускає demo seed автоматично.
- `update.sh` не видаляє базу даних і не виконує destructive reset.
- Скрипти не використовують `docker compose down -v` і не видаляють Docker volumes.
- Паролі та `DATABASE_URL` не виводяться в консоль.

## Перевірка якості

```bash
npm run lint
npm run build
```

Або однією командою:

```bash
npm run check
```

Запустити backend unit tests:

```bash
npm test --workspace apps/api
```

## Сторінки

- `/` — головна
- `/stock` — залишки
- `/nomenclature` — номенклатура
- `/imports` — імпорт
- `/transactions` — журнал операцій

## Поточні обмеження

На цьому етапі не реалізовані передача між МВО, видача, повернення, списання, інвентаризація, QR-коди, серійні номери, КЕП, авторизація, ролі та редагування завершених операцій.

Очистити build-артефакти frontend і backend:

```bash
npm run clean
```
