-- Bound account-scoped recovery/revocation reads as authentication history grows.
-- Additive only: retain all OTP/session history and existing constraints.
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");
CREATE INDEX "OtpCode_userId_purpose_createdAt_id_idx" ON "OtpCode"("userId", "purpose", "createdAt" DESC, "id" DESC);
