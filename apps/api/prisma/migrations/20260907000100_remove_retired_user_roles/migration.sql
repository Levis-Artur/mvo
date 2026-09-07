BEGIN;

-- Prevent a concurrent insert/role change between the preflight and enum replacement.
LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "User" WHERE "role"::text IN ('AUDITOR', 'DPP_ADMIN')
    ) THEN
        RAISE EXCEPTION 'Cannot remove AUDITOR/DPP_ADMIN from UserRole: users with these roles still exist. No users or roles have been changed.';
    END IF;
END;
$$;

-- These expressions contain constants typed as the old enum.
ALTER TABLE "User" DROP CONSTRAINT "User_mvo_responsiblePerson_required_chk";
DROP INDEX "User_single_active_owner_idx";

-- The trigger function has no enum argument/return type and compares NEW.role
-- with an untyped MVO literal. Recreate its trigger and recompile the same body
-- below so no cached expression can retain the old enum type.
DROP TRIGGER "User_enforce_responsible_person_rules" ON "User";

DO $$
DECLARE
    role_default text;
BEGIN
    -- The repository schema has no role default. Preserve one if present,
    -- restoring its original expression only after the enum name is restored.
    SELECT pg_get_expr(d.adbin, d.adrelid)
    INTO role_default
    FROM pg_attrdef d
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE d.adrelid = '"User"'::regclass AND a.attname = 'role';

    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;

    -- Preserve the relative ordering of the surviving historical enum values.
    CREATE TYPE "UserRole_new" AS ENUM ('OWNER', 'MVO', 'ACCOUNTANT', 'ORG_MANAGER');
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new"
        USING ("role"::text::"UserRole_new");

    -- RESTRICT deliberately aborts the whole transaction for any unexpected
    -- enum dependency (for example a function signature or another column).
    DROP TYPE "UserRole" RESTRICT;
    ALTER TYPE "UserRole_new" RENAME TO "UserRole";

    IF role_default IS NOT NULL THEN
        EXECUTE 'ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT ' || role_default;
    END IF;
END;
$$;

ALTER TABLE "User" ADD CONSTRAINT "User_mvo_responsiblePerson_required_chk"
    CHECK ("role" <> 'MVO' OR "responsiblePersonId" IS NOT NULL);
CREATE UNIQUE INDEX "User_single_active_owner_idx" ON "User"("role")
    WHERE "role" = 'OWNER' AND "isActive" = true;

CREATE OR REPLACE FUNCTION "enforce_user_responsible_person_rules"()
RETURNS trigger AS $$
DECLARE
    responsible_person_is_active BOOLEAN;
BEGIN
    IF NEW."responsiblePersonId" IS NULL THEN
        IF NEW."role" = 'MVO' THEN
            RAISE EXCEPTION 'MVO user must be linked to a ResponsiblePerson';
        END IF;

        RETURN NEW;
    END IF;

    SELECT "isActive"
    INTO responsible_person_is_active
    FROM "ResponsiblePerson"
    WHERE "id" = NEW."responsiblePersonId";

    IF responsible_person_is_active IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'User cannot be linked to an inactive ResponsiblePerson';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_enforce_responsible_person_rules"
BEFORE INSERT OR UPDATE OF "role", "responsiblePersonId"
ON "User"
FOR EACH ROW
EXECUTE FUNCTION "enforce_user_responsible_person_rules"();

-- User_role_idx is rebuilt by ALTER COLUMN TYPE. The unique ResponsiblePerson
-- link, foreign keys and all other columns/tables remain intact.
COMMIT;
