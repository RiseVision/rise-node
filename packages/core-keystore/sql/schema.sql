BEGIN;
-- Overwrite unconfirmed tables with state from confirmed tables

CREATE TABLE IF NOT EXISTS "trsassets_keystore" (
  "key" character varying (64) NOT NULL,
  "value" bytea[] NOT NULL,
  "transactionId" VARCHAR(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

COMMIT;
