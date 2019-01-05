BEGIN;

CREATE TABLE IF NOT EXISTS "exceptions" (
  "type" VARCHAR(10) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "remainingCount" INTEGER NOT NULL,
  PRIMARY KEY ("type", "key")
);

COMMIT;
