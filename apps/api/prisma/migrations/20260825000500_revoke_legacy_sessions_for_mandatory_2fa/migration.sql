-- Mandatory 2FA is now required before creating new authenticated sessions.
-- Revoke sessions created before the 2FA login flow existed so every user
-- must pass the new pre-authentication flow on the next login.
UPDATE "UserSession"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL;
