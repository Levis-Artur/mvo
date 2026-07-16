# Security

Version: 1.0 (Draft)

---

# Purpose

Цей документ визначає правила інформаційної безпеки системи MVO Inventory Management System.

Безпека є одним із головних пріоритетів проєкту.

Жодна нова функція не повинна знижувати рівень захисту системи.

---

# Security Principles

Основні принципи:

- Security by Design
- Least Privilege
- Defense in Depth
- Zero Trust
- Secure by Default

---

# Authentication

Авторизація виконується виключно Backend.

Frontend ніколи не приймає рішення про автентичність користувача.

---

# Password Storage

Паролі ніколи не зберігаються відкритим текстом.

Використовується:

- Argon2id

Заборонено:

- SHA1
- SHA256
- MD5
- Base64
- власні алгоритми

---

# Sessions

Кожна сесія має:

- Session ID
- Creation Time
- Expiration Time
- Last Activity
- User ID

У майбутньому:

- Device ID
- Browser Fingerprint

---

# Authorization

Будь-який доступ перевіряється сервером.

Frontend не використовується як механізм захисту.

---

# Roles

Owner

Повний доступ.

---

Auditor

Доступ лише для перегляду.

Без права змінювати дані.

---

DPP Administrator

Керує структурою та користувачами.

---

MVO

Працює лише зі своїм майном.

---

# API Security

Кожен endpoint перевіряє:

- авторизацію;
- права;
- область доступу;
- коректність даних.

---

# Input Validation

Усі DTO проходять серверну перевірку.

Будь-які невідомі поля відхиляються.

---

# SQL Injection

Усі запити виконуються через Prisma ORM.

Ручний SQL допускається лише після окремого рев'ю.

---

# XSS

Frontend не повинен використовувати небезпечний HTML.

Заборонено:

dangerouslySetInnerHTML

без окремого обґрунтування.

---

# CSRF

Усі зміни даних повинні бути захищені від CSRF.

---

# CORS

CORS налаштовується лише на Backend.

Не допускається використання:

```

Access-Control-Allow-Origin: *

```

у production.

---

# Secrets

Усі секрети знаходяться лише:

.env

або

Secret Manager

Заборонено:

- паролі в коді;
- токени в Git;
- ключі в JavaScript.

---

# Logging

Логи не повинні містити:

- паролі;
- JWT;
- токени;
- секрети;
- ключі.

---

# Error Messages

Користувач отримує лише безпечні повідомлення.

Stack Trace не повертається.

---

# Audit

Усі критичні події журналюються.

Наприклад:

- логін;
- зміна пароля;
- створення користувача;
- передача майна;
- імпорт;
- списання.

---

# File Upload

Будь-який файл перевіряється:

- MIME Type
- Size
- Extension

У майбутньому:

- Antivirus Scan

---

# Database

Доступ до PostgreSQL має лише Backend.

Frontend ніколи не підключається напряму.

---

# Backups

Повинні виконуватися регулярно.

Резервні копії повинні перевірятися на можливість відновлення.

---

# Production

Production повинен використовувати:

- HTTPS
- HSTS
- Secure Cookies
- HttpOnly Cookies

---

# Future Improvements

Планується:

- Two-Factor Authentication
- Hardware Security Keys
- Audit Dashboard
- Login Notifications
- Device Management
- Session Management

---

End of document.