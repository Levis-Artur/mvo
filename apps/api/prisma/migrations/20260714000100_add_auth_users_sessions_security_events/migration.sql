CREATE TYPE "UserRole" AS ENUM ('OWNER', 'AUDITOR', 'DPP_ADMIN', 'MVO');

CREATE TYPE "SecurityEventType" AS ENUM (
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGOUT',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_BLOCKED',
    'USER_UNBLOCKED',
    'USER_ACTIVATED',
    'USER_DEACTIVATED',
    'ROLE_CHANGED',
    'SESSIONS_REVOKED',
    'ACCESS_DENIED'
);

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "responsiblePersonId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_failedLoginAttempts_non_negative_chk" CHECK ("failedLoginAttempts" >= 0),
    CONSTRAINT "User_mvo_responsiblePerson_required_chk" CHECK ("role" <> 'MVO' OR "responsiblePersonId" IS NOT NULL)
);

CREATE TABLE "UserSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SecurityEvent" (
    "id" UUID NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "actorUserId" UUID,
    "targetUserId" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_responsiblePersonId_key" ON "User"("responsiblePersonId");
CREATE UNIQUE INDEX "User_single_active_owner_idx" ON "User"("role") WHERE "role" = 'OWNER' AND "isActive" = true;
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "User_createdById_idx" ON "User"("createdById");
CREATE INDEX "User_responsiblePersonId_idx" ON "User"("responsiblePersonId");

CREATE UNIQUE INDEX "UserSession_tokenHash_key" ON "UserSession"("tokenHash");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE INDEX "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");

CREATE INDEX "SecurityEvent_type_idx" ON "SecurityEvent"("type");
CREATE INDEX "SecurityEvent_actorUserId_idx" ON "SecurityEvent"("actorUserId");
CREATE INDEX "SecurityEvent_targetUserId_idx" ON "SecurityEvent"("targetUserId");
CREATE INDEX "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");
CREATE INDEX "SecurityEvent_success_idx" ON "SecurityEvent"("success");

ALTER TABLE "User" ADD CONSTRAINT "User_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "ResponsiblePerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
