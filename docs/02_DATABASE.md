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

# Owner/Custody Accounting Model

Актуальна модель поточного стану використовує два взаємовиключні bucket-и:

- `StockBalance` — прямий залишок МВО як accounting owner;
- `CustodyBalance` — кількість номенклатури accounting owner, що фізично
  перебуває в іншого custodian.

`CustodyBalance` має унікальний ключ
`inventoryItemId + accountingOwnerResponsiblePersonId + custodianResponsiblePersonId`.
DB check constraints забороняють від’ємну кількість та однакові owner/custodian.
Нульовий рядок може залишатися як технічний поточний стан, але read models
повертають активні залишки з `quantity > 0`.

`StockDocumentLine` фіксує `sourceKind` (`DIRECT`/`ASSIGNED`), accounting owner,
source custodian і за потреби `sourceCustodyBalanceId`. Ці поля nullable для
legacy-рядків. `StockTransaction` зберігає accounting model, bucket, owner,
source/destination custodian, document/line та self-relation reversal. Старі
транзакції з nullable metadata залишаються валідними.

`StockDocumentAttachment` містить лише metadata: оригінальну і збережену назву,
MIME, розмір, SHA-256, storage path, uploader та час. Бінарний файл зберігається
в окремому volume, не в PostgreSQL.

Картки МВО й номенклатури обчислюють підсумки з тих самих таблиць:

```text
totalAccounted = SUM(StockBalance.quantity) + SUM(CustodyBalance.quantity)
```

`assignedToMe` використовується тільки для фізично утримуваного майна і не
додається до own/direct balance.

## Additive migrations

- `20260720000100_add_owner_custody_accounting_foundation` — ACCOUNTANT,
  owner/custody schema, ASSIGNMENT, source metadata, attachments та constraints;
- `20260720000200_add_assignment_in_direct_transaction` — явний рух повернення
  custody до direct accounting owner;
- `20260720000300_add_import_action_audit_event` — окремий тип audit event для
  імпортних мутацій.

Міграції не перераховують і не видаляють legacy `TRANSFER`.

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
