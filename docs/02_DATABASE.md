# Database Design

Version: 1.0

---

# Purpose

Цей документ описує модель даних MVO Inventory Management System.

Він визначає принципи побудови бази даних, правила моделювання та взаємозв'язки між сутностями.

Будь-які зміни структури БД повинні спочатку бути відображені в цьому документі.

---

# Database Engine

Основна СУБД:

PostgreSQL

ORM:

Prisma ORM

Міграції:

Prisma Migrate

---

# Design Principles

При проектуванні бази даних використовуються наступні принципи:

- Normalization First
- Referential Integrity
- Explicit Relations
- Immutable Audit
- Predictable Naming

---

# Naming Convention

Усі таблиці використовують однину.

Приклади:

User

Role

InventoryItem

Stock

Transfer

Import

AuditEvent

---

# Primary Keys

Усі таблиці використовують UUID.

Приклад:

id UUID PRIMARY KEY

---

# Foreign Keys

Усі зв'язки реалізуються через зовнішні ключі.

Видалення записів не повинно порушувати цілісність даних.

---

# Soft Delete

Для бізнес-сутностей використовується Soft Delete.

Поля:

deletedAt

deletedBy

Фізичне видалення допускається лише для службових або тимчасових даних.

---

# Timestamps

Кожна таблиця повинна містити:

createdAt

updatedAt

За потреби:

deletedAt

---

# Auditability

Усі критичні зміни повинні бути відтворюваними.

Не допускається втрата історії зміни даних.

---

# Transactions

Будь-які операції, що змінюють залишки або документи, виконуються всередині транзакції PostgreSQL.

---

# Indexes

Індекси створюються для:

- зовнішніх ключів;
- полів пошуку;
- унікальних значень;
- часто використовуваних фільтрів.

---

# Unique Constraints

Унікальні обмеження використовуються лише там, де це необхідно бізнес-логікою.

Приклади:

- Login
- Badge Number (якщо використовується)
- VIN
- Serial Number

---

# Data Integrity

База даних повинна гарантувати:

- відсутність "висячих" записів;
- відсутність дублювання ключових сутностей;
- коректність зв'язків.

---

# Main Entities

Основні бізнес-сутності системи:

- Organization
- RegionalDivision
- StructuralUnit
- User
- Role
- MVO
- InventoryItem
- InventoryInstance
- Stock
- StockMovement
- BusinessDocument
- DocumentLine
- Transaction
- Import
- AuditEvent
- Attachment

---

# Relationships

Organization

↓

RegionalDivision

↓

StructuralUnit

↓

User

↓

MVO

↓

Stock

↓

InventoryItem

↓

BusinessDocument

↓

Transaction

---

# Prisma Rules

Усі моделі описуються лише в schema.prisma.

Заборонено:

- ручне редагування production database;
- створення таблиць без Prisma Migration;
- зміна структури БД напряму.

---

# Migrations

Будь-яка зміна структури БД повинна супроводжуватися:

- Prisma Migration;
- оновленням документації;
- перевіркою сумісності;
- тестами.

---

# Backup Strategy

База даних повинна регулярно резервуватися.

Повинні існувати процедури:

- Backup
- Restore
- Disaster Recovery

---

# Future Database Features

У перспективі планується:

---

# Direct-balance accounting model

Поточний стан обліку визначається тільки таблицею `StockBalance`.
Один рядок з унікальним ключем `responsiblePersonId + inventoryItemId` містить
актуальну кількість конкретної номенклатури у конкретного МВО.

- проведений CSV-імпорт збільшує `StockBalance` адресата;
- `MVO_TRANSFER` зменшує тільки `StockBalance` відправника;
- одержувач передачі не отримує залишок автоматично;
- `ISSUE` зменшує тільки прямий залишок МВО;
- скасування передачі або видачі створює reversal-транзакцію та відновлює
  прямий залишок джерела;
- експорт для бухгалтерії не змінює залишків.

`StockTransaction` є незмінною історією. Для нових рухів використовуються
`DIRECT_BALANCE`, `MVO_TRANSFER_OUT`, `MVO_TRANSFER_REVERSAL`, `ISSUE_OUT`,
`ISSUE_REVERSAL`, `IMPORT_RECEIPT` та посилання на документ/рядок/імпорт.
`quantityBefore` і `quantityAfter` дозволяють відтворити зміну без перерахунку
поточного залишку.

## Legacy owner/custody archive

`CustodyBalance`, `StockSourceKind.ASSIGNED`, тип `ASSIGNMENT` і nullable custody
поля в `StockDocumentLine`/`StockTransaction` збережені лише для аудиту раніше
проведених документів. Нові write-path їх не створюють і не змінюють.

Таблиця та зовнішні ключі не видаляються, доки production-перевірка не доведе,
що дані перенесено в окрему read-only історію і жоден звіт не залежить від них.
Видалення можливе тільки окремою погодженою міграцією після backup, verification
queries та перевіреного rollback plan.

`StockDocumentAttachment` містить лише metadata: оригінальну і збережену назву,
MIME, розмір, SHA-256, storage path, uploader та час. Бінарний файл зберігається
в окремому volume, не в PostgreSQL.

Поточні підсумки карток обчислюються лише зі `StockBalance`:

```text
currentQuantity = SUM(StockBalance.quantity)
```

Legacy custody-рядки можуть показуватися окремою секцією «Архів старої моделі»,
але ніколи не додаються до поточного залишку.

## Additive migrations

- `20260720000100_add_owner_custody_accounting_foundation` — ACCOUNTANT,
  owner/custody schema, ASSIGNMENT, source metadata, attachments та constraints;
- `20260720000200_add_assignment_in_direct_transaction` — явний рух повернення
  custody до direct accounting owner;
- `20260720000300_add_import_action_audit_event` — окремий тип audit event для
  імпортних мутацій.
- `20260721000200_add_mvo_transfer_direct_balance` — новий `MVO_TRANSFER`,
  direct-balance transaction types і snapshot кількості в рядках;
- `20260721000300_add_accounting_transfer_exports` — бухгалтерські export batch
  без впливу на залишки.
- `20260722000100_harden_accounting_transfer_exports` — additive attribution,
  nullable `displayNumber` для legacy snapshots і `formatVersion`: наявні пакети
  отримують `V1` під час `ADD COLUMN`, після чого database default змінюється на
  `V2`; application також явно створює нові пакети як `V2`. Міграція не
  переписує historical rows або збережені SHA-256.

Міграції не перераховують і не видаляють legacy `TRANSFER`, `ASSIGNMENT` або
`CustodyBalance`.

Для `AccountingTransferExportBatchDocument.documentId` навмисно не додано
глобальний unique constraint: до production-аудиту невідомо, чи старі дані вже
містять документ у кількох пакетах. Runtime захищає нові exports serializable
transaction та умовним claim `POSTED + NOT_EXPORTED`; constraint можна додати
лише окремою міграцією після успішних verification queries і backup.

PostgreSQL concurrency integration test використовує лише явно заданий
`TEST_DATABASE_URL`. CI має застосувати всі migrations до окремої disposable
test database перед запуском API tests; production URL для цього тесту
використовувати заборонено.

### Accounting export integrity queries

```sql
-- Документи, що потрапили більш ніж до одного пакета.
SELECT "documentId", COUNT(DISTINCT "batchId") AS batch_count
FROM "AccountingTransferExportBatchDocument"
GROUP BY "documentId"
HAVING COUNT(DISTINCT "batchId") > 1;

-- Пакети без snapshot rows.
SELECT batch."id"
FROM "AccountingTransferExportBatch" AS batch
LEFT JOIN "AccountingTransferExportRow" AS row
  ON row."batchId" = batch."id"
GROUP BY batch."id"
HAVING COUNT(row."id") = 0;

-- Snapshot rows без відповідного document link у тому самому пакеті.
SELECT row."id", row."batchId", row."documentId"
FROM "AccountingTransferExportRow" AS row
LEFT JOIN "AccountingTransferExportBatchDocument" AS link
  ON link."batchId" = row."batchId"
 AND link."documentId" = row."documentId"
WHERE link."documentId" IS NULL;

-- Документи зі станом EXPORTED без збереженого batch link.
SELECT document."id", document."displayNumber"
FROM "StockDocument" AS document
LEFT JOIN "AccountingTransferExportBatchDocument" AS link
  ON link."documentId" = document."id"
WHERE document."type" = 'MVO_TRANSFER'
  AND document."accountingExportState" = 'EXPORTED'
  AND link."documentId" IS NULL;
```

## Production verification queries

Перед майбутнім вилученням legacy-схеми потрібно зафіксувати результати:

```sql
SELECT COUNT(*) AS rows,
       COUNT(*) FILTER (WHERE quantity <> 0) AS non_zero_rows
FROM "CustodyBalance";

SELECT type, status, COUNT(*)
FROM "StockDocument"
WHERE type IN ('TRANSFER', 'ASSIGNMENT')
   OR "accountingModel" = 'OWNER_CUSTODY'
GROUP BY type, status;

SELECT COUNT(*)
FROM "StockTransaction"
WHERE "accountingModel" = 'OWNER_CUSTODY'
   OR "bucketKind" = 'ASSIGNED';
```

Ненульовий результат не є помилкою і не дає дозволу на delete: це сигнал, що
legacy adapter і таблиці треба залишити. У цьому релізі destructive migration
відсутня.

- партиціонування великих таблиць;
- архівування історичних даних;
- read-only replica;
- автоматичний контроль цілісності;
- оптимізація великих звітів.

---

End of document.

## Stock movement documents

Рух майна моделюється через `StockDocument` і `StockDocumentLine`.
Проведені документи створюють незмінні `StockTransaction`, пов’язані через
nullable `documentId` і `documentLineId`. Наявні імпортні операції залишаються
сумісними, оскільки нові зовнішні ключі nullable.
