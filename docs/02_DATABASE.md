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

- партиціонування великих таблиць;
- архівування історичних даних;
- read-only replica;
- автоматичний контроль цілісності;
- оптимізація великих звітів.

---

End of document.