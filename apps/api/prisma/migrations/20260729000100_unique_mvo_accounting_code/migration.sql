BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ResponsiblePerson"
    WHERE "externalAccountingCode" IS NOT NULL
    GROUP BY "externalAccountingCode"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate ResponsiblePerson.externalAccountingCode values must be resolved before this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "ResponsiblePerson_externalAccountingCode_key"
ON "ResponsiblePerson"("externalAccountingCode");

DROP INDEX "ResponsiblePerson_externalAccountingCode_idx";

COMMIT;
