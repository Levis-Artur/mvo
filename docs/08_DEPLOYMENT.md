# Розгортання та резервне копіювання

## Вкладення видаткових накладних

Фото та PDF видаткових накладних не зберігаються у PostgreSQL. Production API
використовує окремий Docker volume `stock_document_attachments`, змонтований у
`/app/data/stock-document-attachments`. Цей каталог не монтується в nginx і не
може бути відкритий як статичний ресурс. Завантаження та скачування виконується
лише через авторизовані endpoint-и `/api/stock-documents/:id/attachments`.

Обов’язкові параметри середовища:

- `MAX_ATTACHMENT_FILE_SIZE_MB` — максимальний розмір одного вкладення,
  типовим значенням є 10 MB;
- `MAX_UPLOAD_FILE_SIZE_MB` — загальний ліміт nginx, який має бути не меншим за
  `MAX_IMPORT_FILE_SIZE_MB` і `MAX_ATTACHMENT_FILE_SIZE_MB`;
- `STOCK_DOCUMENT_ATTACHMENTS_DIR` — внутрішній каталог API. Для production
  compose слід залишити `/app/data/stock-document-attachments`.

Не монтуйте volume вкладень у web або nginx. Не змінюйте власника каталогу:
контейнер API працює від непривілейованого користувача `node`.

## Backup

Команда `./backup.sh` створює узгоджену пару файлів з однаковою часовою міткою:

```text
backups/mvo_YYYY-MM-DD_HH-MM-SS.sql.gz
backups/mvo_YYYY-MM-DD_HH-MM-SS.attachments.tar.gz
```

Перший файл містить PostgreSQL metadata, другий — фізичні файли volume
вкладень. Обидва файли мають зберігатися та переноситися разом. Політика
`BACKUP_RETENTION_DAYS` очищує обидва типи архівів.

Для узгодженого snapshot `backup.sh` короткочасно зупиняє API, якщо він був
запущений, створює обидва архіви та автоматично запускає API з перевіркою
health. PostgreSQL під час цього залишається доступним контейнеру backup.

## Restore

Для відновлення передається шлях до SQL-архіву:

```bash
./restore.sh backups/mvo_YYYY-MM-DD_HH-MM-SS.sql.gz
```

Скрипт обов’язково перевіряє наявність однойменного
`.attachments.tar.gz`, створює актуальний backup, зупиняє API, відновлює базу
та volume, після чого запускає API і перевіряє health endpoint. Відновлення без
архіву вкладень блокується, оскільки воно могло б створити metadata без файлів.

Після restore OWNER повинен перевірити:

```text
GET /api/stock-documents/maintenance/attachment-orphans
```

Непорожні `metadataWithoutFile` або `filesWithoutMetadata` означають, що
сховище потребує ручної перевірки. Endpoint нічого не видаляє автоматично.

## Production rollout owner/custody model

1. Створити перевірену пару backup БД + attachments і перевірити вільне місце.
2. Розгорнути образи без зупинки PostgreSQL, але не направляти користувачів на
   новий API до завершення міграцій.
3. Виконати `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma`.
   Міграції additive: legacy `TRANSFER` не перераховується.
4. Запустити API та перевірити `GET /api/health`, потім web і nginx.
5. Виконати smoke checks під ролями OWNER, ACCOUNTANT, AUDITOR та MVO:
   імпорт у DIRECT, перегляд карток, draft ASSIGNMENT/ISSUE, upload/download
   attachment. Не проводити тестові документи на production без погодження.
6. Перевірити attachment-orphans, audit events з requestId та формулу
   `totalAccounted = direct + assigned` на контрольній номенклатурі.
7. Залишити legacy `TRANSFER` тільки для читання. Нові передачі створюються як
   `ASSIGNMENT`, хоча в UI називаються «Передача».

Rollback application release виконується поверненням попередніх образів.
Схему не слід downgrade вручну: нові таблиці/nullable поля сумісні зі старими
даними. Якщо потрібне повне відновлення, використовується лише узгоджена пара
SQL та attachments archive через `restore.sh`.
