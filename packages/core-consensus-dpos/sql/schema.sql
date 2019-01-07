BEGIN;
-- Overwrite unconfirmed tables with state from confirmed tables


ALTER TABLE "mem_accounts"
 ADD COLUMN IF NOT EXISTS "forgingPK" BYTEA UNIQUE,
 ADD COLUMN IF NOT EXISTS "cmb" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "username" VARCHAR(20),
 ADD COLUMN IF NOT EXISTS "u_username" VARCHAR(20),
 ADD COLUMN IF NOT EXISTS "vote" BIGINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "votesWeight" BIGINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "rank" INTEGER DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "u_isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "producedblocks" integer DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "missedblocks" SMALLINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "fees" BIGINT DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "rewards" BIGINT DEFAULT 0;


CREATE TABLE IF NOT EXISTS "trsassets_votes" (
  "added" character varying (20)[],
  "removed" character varying (20)[],
  "transactionId" VARCHAR(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "trsassets_delegates" (
  "username" character varying(20) UNIQUE,
  "forgingPK" bytea NOT NULL UNIQUE,
  "transactionId" character varying(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mem_accounts2delegates (
  "address" character varying(250) NOT NULL,
  "username" character varying(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS mem_accounts2u_delegates (
  "address" character varying(250) NOT NULL,
  "username" character varying(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS "rounds_fees" (
	"height"    INT     NOT NULL,
	"timestamp" INT     NOT NULL,
	"fees"      BIGINT  NOT NULL,
	"username" character varying(20) NOT NULL
);


CREATE INDEX IF NOT EXISTS "idx_mem_accounts2delegates_username" ON public.mem_accounts2delegates USING btree ("username");
CREATE INDEX IF NOT EXISTS "idx_trsassets_votes_id" ON "trsassets_votes"("transactionId");
CREATE INDEX IF NOT EXISTS "idx_trsassets_delegates_id" ON "trsassets_delegates"("transactionId");


-- Flush unconfirmed state and restore with confirmed table.
DELETE FROM mem_accounts2u_delegates;

INSERT INTO mem_accounts2u_delegates ("address", "username")
  SELECT "address", "username" FROM mem_accounts2delegates;

COMMIT;
