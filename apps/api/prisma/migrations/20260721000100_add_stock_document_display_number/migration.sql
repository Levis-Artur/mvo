-- Add a user-facing number without changing the legacy documentNumber field.
-- Existing documents are numbered deterministically by creation time and UUID.
ALTER TABLE "StockDocument" ADD COLUMN "displayNumber" INTEGER;

WITH "numberedDocuments" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC)::INTEGER AS "displayNumber"
  FROM "StockDocument"
)
UPDATE "StockDocument" AS "document"
SET "displayNumber" = "numberedDocuments"."displayNumber"
FROM "numberedDocuments"
WHERE "document"."id" = "numberedDocuments"."id";

CREATE SEQUENCE "StockDocument_displayNumber_seq";

SELECT setval(
  '"StockDocument_displayNumber_seq"',
  COALESCE(MAX("displayNumber"), 1),
  MAX("displayNumber") IS NOT NULL
)
FROM "StockDocument";

ALTER SEQUENCE "StockDocument_displayNumber_seq"
  OWNED BY "StockDocument"."displayNumber";

ALTER TABLE "StockDocument"
  ALTER COLUMN "displayNumber" SET DEFAULT nextval('"StockDocument_displayNumber_seq"'),
  ALTER COLUMN "displayNumber" SET NOT NULL;

CREATE UNIQUE INDEX "StockDocument_displayNumber_key"
  ON "StockDocument"("displayNumber");
