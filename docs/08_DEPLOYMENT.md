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

## Production rollout direct-balance model

1. Увімкнути maintenance window для write-операцій та зафіксувати версії
   поточних API/web images.
2. Створити узгоджену пару backup PostgreSQL + archive attachments через
   `backup.sh`; перевірити checksum, розмір і тестове читання архівів.
3. До deployment виконати read-only verification queries з
   `docs/02_DATABASE.md`. Ненульовий `CustodyBalance` очікуваний і не повинен
   видалятися або перераховуватися.
4. Виконати:

   ```bash
   npx prisma validate --schema apps/api/prisma/schema.prisma
   npx prisma migrate status --schema apps/api/prisma/schema.prisma
   npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
   ```

5. Розгорнути API, перевірити `GET /api/health`, потім web і nginx. Каталог
   attachments не публікувати через nginx.
6. Виконати smoke checks без production-мутацій: legacy-документи читаються,
   бухгалтерський register/export відкривається, картка номенклатури показує
   `StockBalance` та окремі рухи.
7. У погодженому тестовому контурі перевірити ланцюжок: import +10 A →
   `MVO_TRANSFER` −2 A (B без змін) → import +5 B → `ISSUE` −1 A → reversal
   передачі +2 A. Перевірити attachment і audit/requestId.
8. Після спостереження відкрити write traffic та контролювати 4xx/5xx,
   від’ємні залишки, повторні posting/cancel і orphan attachments.

Rollback application release виконується поверненням попередніх API/web images,
без ручного downgrade схеми. Якщо новий код уже створив документи, write traffic
спочатку зупиняють і перевіряють їх статуси; часткове відновлення БД заборонене.
Повне відновлення виконується тільки узгодженою парою SQL + attachments archive.
Legacy `CustodyBalance`, FKs і nullable custody metadata залишаються в схемі,
тому цей rollout не має destructive database-кроків.
