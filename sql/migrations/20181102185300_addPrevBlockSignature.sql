BEGIN;

ALTER TABLE "blocks" ADD COLUMN IF NOT EXISTS "previousBlockIDSignature" bytea;

-- Set dummy value
UPDATE blocks SET "previousBlockIDSignature" = '\001'::bytea;

ALTER TABLE blocks ALTER COLUMN "previousBlockIDSignature" SET NOT NULL;


COMMIT;
