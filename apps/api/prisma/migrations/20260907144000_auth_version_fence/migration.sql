-- Additive credential-proof fence; existing accounts begin at version zero.
-- Session/OTP history and password hashes are preserved.
ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
