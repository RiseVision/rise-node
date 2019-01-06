BEGIN;
-- Overwrite unconfirmed tables with state from confirmed tables

CREATE TABLE IF NOT EXISTS "trsassets_votes_old" (
  "votes" TEXT,
  "transactionId" VARCHAR(20) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

COMMIT;
