# API Guidelines

Version: 1.0

---

# Purpose

Цей документ визначає правила розробки REST API системи MVO Inventory Management System.

Усі нові endpoint повинні відповідати цим правилам.

---

# General Principles

API повинно бути:

- передбачуваним;
- типізованим;
- безпечним;
- документованим;
- однаковим для всіх модулів.

Backend є єдиним джерелом бізнес-логіки та контролю доступу.

---

# Base Path

Усі endpoint розміщуються під базовим шляхом:

```text
/api

Приклади:

/api/users
/api/responsible-persons
/api/nomenclature
/api/documents
/api/imports
Resource Naming

Назви ресурсів використовуються у множині.

Правильно:

/users
/documents
/imports
/stock-balances

Неправильно:

/user
/createDocument
/getUsers

Назви endpoint не повинні містити дієслова, якщо дія може бути виражена HTTP-методом.

HTTP Methods
GET

Отримання даних.

GET-запит не повинен змінювати стан системи.

Приклади:

GET /api/users
GET /api/users/:id
GET /api/documents
GET /api/documents/:id
POST

Створення ресурсу або виконання окремої бізнес-дії.

Приклади:

POST /api/users
POST /api/documents
POST /api/documents/:id/post
POST /api/documents/:id/cancel
PATCH

Часткове оновлення ресурсу.

Приклад:

PATCH /api/users/:id

Проведені бізнес-документи не повинні редагуватися через PATCH.

DELETE

Фізичне видалення бізнес-даних не використовується.

DELETE допускається лише для:

чернеток без господарських операцій;
тимчасових файлів;
службових даних;
сутностей, для яких видалення явно дозволене бізнес-правилами.

У більшості випадків використовується деактивація або скасування.

HTTP Status Codes

API повинно використовувати коректні HTTP-коди.

200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
Standard Error Response

Усі помилки повертаються у стандартному форматі:

{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Дані не пройшли перевірку",
  "details": {
    "messages": [
      "Поле name є обов’язковим"
    ]
  },
  "path": "/api/documents",
  "requestId": "uuid",
  "timestamp": "2026-07-16T10:00:00.000Z"
}
Error Codes

Поле code є стабільним машинним кодом помилки.

Frontend не повинен визначати тип помилки за текстом message.

Приклади:

VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
DUPLICATE_RESOURCE
INSUFFICIENT_STOCK
INVALID_DOCUMENT_STATUS
DOCUMENT_ALREADY_POSTED
INTERNAL_SERVER_ERROR
Request ID

Кожен запит повинен мати requestId.

Клієнт може передати заголовок:

X-Request-ID

Якщо заголовок відсутній або невалідний, backend генерує UUID.

Backend повертає той самий ідентифікатор у:

X-Request-ID

та в тілі помилки.

DTO Validation

Кожен endpoint, який приймає дані, повинен використовувати DTO.

DTO повинно перевіряти:

типи;
обов’язкові поля;
довжину рядків;
формат UUID;
діапазон чисел;
допустимі enum-значення.

Невідомі поля повинні відхилятися.

Authentication

Приватні endpoint доступні лише автентифікованим користувачам.

Винятки повинні бути позначені явно.

Приклади публічних endpoint:

POST /api/auth/login
GET /api/health
Authorization

Кожен endpoint повинен перевіряти:

роль користувача;
область доступу;
належність ресурсу;
статус ресурсу;
дозвіл на конкретну дію.

Приховування кнопки на frontend не є механізмом захисту.

Pagination

Списки повинні підтримувати пагінацію.

Рекомендований формат запиту:

GET /api/documents?page=1&pageSize=25

Рекомендований формат відповіді:

{
  "items": [],
  "page": 1,
  "pageSize": 25,
  "totalItems": 0,
  "totalPages": 0
}

Максимальний pageSize повинен обмежуватися backend.

Filtering

Фільтри передаються через query parameters.

Приклад:

GET /api/documents?type=TRANSFER&status=POSTED&authorId=uuid

Backend повинен ігнорувати або відхиляти недозволені фільтри згідно з DTO.

Sorting

Сортування задається параметрами:

sortBy=createdAt
sortOrder=desc

Дозволені поля сортування повинні бути явно визначені.

Не можна напряму передавати довільне поле користувача в Prisma orderBy.

Dates

Дати та час передаються у форматі ISO 8601.

Приклад:

2026-07-16T10:30:00.000Z

У базі та API використовується UTC.

Перетворення в локальний час виконується на frontend.

Numeric Values

Кількість майна не повинна передаватися як JavaScript floating-point число без контролю точності.

Для значень Prisma Decimal API може використовувати рядки.

Приклад:

{
  "quantity": "15.0000"
}
Business Documents API

Усі документи руху майна використовують універсальний ресурс:

/api/documents

Тип документа визначається полем:

type

Приклади типів:

RECEIPT
TRANSFER
ISSUE
RETURN
WRITE_OFF
INVENTORY_ADJUSTMENT
Document Lifecycle

Рекомендовані дії:

POST /api/documents
GET /api/documents/:id
PATCH /api/documents/:id
POST /api/documents/:id/submit
POST /api/documents/:id/approve
POST /api/documents/:id/post
POST /api/documents/:id/cancel

Доступні дії залежать від типу документа, статусу та ролі користувача.

Document Statuses

Базові статуси:

DRAFT
PENDING
APPROVED
POSTED
CANCELLED

Проведений документ не редагується.

Помилка виправляється через скасування або компенсуючий документ.

Idempotency

Критичні операції повинні бути захищені від повторного виконання.

Особливо:

проведення документа;
підтвердження передачі;
імпорт;
скасування документа.

Повторний однаковий запит не повинен створювати подвійний рух майна.

Transactions

Операції, які змінюють залишки, виконуються в одній транзакції бази даних.

У разі помилки:

документ не змінює статус;
залишки не змінюються;
часткові транзакції не зберігаються.
Logging

Критичні запити повинні логувати:

requestId;
userId;
endpoint;
method;
результат;
тривалість;
код помилки.

Паролі, cookie, токени та інші секрети не логуються.

File Uploads

Для файлів повинні перевірятися:

максимальний розмір;
MIME type;
розширення;
контрольна сума;
права користувача.

Оригінальні файли імпорту повинні зберігатися для аудиту.

Versioning

Поки API використовується лише поточним frontend, окрема версія в URL не є обов’язковою.

Перед зовнішньою інтеграцією слід перейти до:

/api/v1

Несумісні зміни API потребують нової версії.

Documentation Requirements

При додаванні або зміні endpoint необхідно оновити:

DTO;
типи frontend;
тести;
відповідну документацію;
README модуля, якщо він існує.
Testing Requirements

Новий endpoint повинен мати тести для:

успішного сценарію;
неавторизованого доступу;
недостатніх прав;
невалідних даних;
відсутнього ресурсу;
бізнес-конфлікту;
області доступу MVO.
Forbidden Practices

Заборонено:

повертати stack trace;
повертати Prisma-помилки напряму;
використовувати довільний any;
приймати неперевірений req.body;
покладатися на frontend для авторизації;
змінювати залишки поза модулем документів або імпорту;
створювати приховані endpoint без документації.