ALTER TYPE "UserRole" ADD VALUE 'ORG_MANAGER';

CREATE TABLE "UserAccessScope" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "managementId" UUID,
    "serviceCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessScope_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserAccessScope_non_empty_check"
        CHECK ("managementId" IS NOT NULL OR "serviceCode" IS NOT NULL),
    CONSTRAINT "UserAccessScope_service_code_not_blank_check"
        CHECK ("serviceCode" IS NULL OR btrim("serviceCode") <> '')
);

CREATE INDEX "UserAccessScope_userId_idx" ON "UserAccessScope"("userId");
CREATE INDEX "UserAccessScope_managementId_idx" ON "UserAccessScope"("managementId");
CREATE INDEX "UserAccessScope_serviceCode_idx" ON "UserAccessScope"("serviceCode");

CREATE UNIQUE INDEX "UserAccessScope_user_management_unique"
    ON "UserAccessScope"("userId", "managementId")
    WHERE "managementId" IS NOT NULL AND "serviceCode" IS NULL;

CREATE UNIQUE INDEX "UserAccessScope_user_service_unique"
    ON "UserAccessScope"("userId", "serviceCode")
    WHERE "managementId" IS NULL AND "serviceCode" IS NOT NULL;

CREATE UNIQUE INDEX "UserAccessScope_user_management_service_unique"
    ON "UserAccessScope"("userId", "managementId", "serviceCode")
    WHERE "managementId" IS NOT NULL AND "serviceCode" IS NOT NULL;

ALTER TABLE "UserAccessScope"
    ADD CONSTRAINT "UserAccessScope_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAccessScope"
    ADD CONSTRAINT "UserAccessScope_managementId_fkey"
    FOREIGN KEY ("managementId") REFERENCES "Management"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
