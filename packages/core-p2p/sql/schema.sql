BEGIN;

CREATE TABLE IF NOT EXISTS "peers" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "ip" INET NOT NULL,
  "port" SMALLINT NOT NULL,
  "state" SMALLINT NOT NULL,
  "os" VARCHAR(64),
  "version" VARCHAR(11),
  "clock" BIGINT,
  "height" INTEGER,
  "broadhash" BYTEA
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_peers_unique" ON "peers"("ip", "port");

UPDATE "peers" SET "state" = 1, "clock" = NULL WHERE "state" != 0;

COMMIT;
