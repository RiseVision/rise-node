BEGIN;

ALTER TABLE "mem_accounts"
 ADD COLUMN IF NOT EXISTS "secondSignature" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "u_secondSignature" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "secondPublicKey" BYTEA;

CREATE TABLE IF NOT EXISTS "trsassets_secondsignature"(
  "transactionId" VARCHAR(20) NOT NULL PRIMARY KEY,
  "publicKey" bytea NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES trs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_signatures_trs_id" ON "trsassets_secondsignature"("transactionId");
COMMIT;
