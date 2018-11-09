BEGIN;

ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "previousBlockIDSignature" bytea;

COMMIT;
