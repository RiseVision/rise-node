BEGIN

ALTER TABLE "mem_accounts"
 ADD COLUMN "cmb" SMALLINT DEFAULT 0,
 ADD COLUMN "username" VARCHAR(20) UNIQUE,
 ADD COLUMN "forgingPK" bytea UNIQUE,
 ADD COLUMN "vote" BIGINT DEFAULT 0,
 ADD COLUMN "votesWeight" BIGINT DEFAULT 0,
 ADD COLUMN "rank" INTEGER DEFAULT 0,
 ADD COLUMN "isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN "u_isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN "producedblocks" integer DEFAULT 0,
 ADD COLUMN "missedblocks" SMALLINT DEFAULT 0,
 ADD COLUMN "fees" BIGINT DEFAULT 0,
 ADD COLUMN "rewards" BIGINT DEFAULT 0;

CREATE TABLE IF NOT EXISTS "votes" (
  "added" character varying (20)[],
  "removed" character varying (20)[],
  "transactionId" VARCHAR(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "delegates" (
  "username" character varying(20) UNIQUE,
  "forgingPK" bytea NOT NULL UNIQUE,
  "transactionId" character varying(250) NOT NULL UNIQUE,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE TABLE mem_accounts2delegates (
  "address" character varying(250) NOT NULL,
  "username" character varying(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS "rounds_fees"(
	"height"    INT     NOT NULL,
	"timestamp" INT     NOT NULL,
	"fees"      BIGINT  NOT NULL,
	"username" character varying(20) NOT NULL
);


CREATE INDEX "idx_mem_accounts2delegates_accountId" ON public.mem_accounts2delegates USING btree ("accountId");

COMMIT;
