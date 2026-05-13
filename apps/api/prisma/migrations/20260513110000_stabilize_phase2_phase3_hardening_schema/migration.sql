-- Stabilize Phase 2/3 hardening schema alignment.
-- Canteen wallet corrections are recorded as immutable correction transactions.

ALTER TYPE "CanteenWalletTransactionSource" ADD VALUE IF NOT EXISTS 'CORRECTION';
