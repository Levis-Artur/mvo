CREATE TYPE "PreAuthChallengeStage" AS ENUM (
    'CHANGE_PASSWORD',
    'ENROLL_2FA',
    'VERIFY_2FA'
);

CREATE TABLE "PreAuthChallenge" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "stage" "PreAuthChallengeStage" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PreAuthChallenge_tokenHash_key"
ON "PreAuthChallenge"("tokenHash");

CREATE INDEX "PreAuthChallenge_userId_idx"
ON "PreAuthChallenge"("userId");

CREATE INDEX "PreAuthChallenge_expiresAt_idx"
ON "PreAuthChallenge"("expiresAt");

ALTER TABLE "PreAuthChallenge"
ADD CONSTRAINT "PreAuthChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
