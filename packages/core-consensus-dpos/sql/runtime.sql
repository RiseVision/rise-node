BEGIN;
-- Overwrite unconfirmed tables with state from confirmed tables
DELETE FROM mem_accounts2u_delegates;
INSERT INTO mem_accounts2u_delegates ("address", "username") SELECT "address", "username" FROM mem_accounts2delegates;

ALTER TABLE "mem_accounts"
 ADD COLUMN "cmb" SMALLINT DEFAULT 0,
 ADD COLUMN "username" VARCHAR(20),
 ADD COLUMN "vote" BIGINT DEFAULT 0,
 ADD COLUMN "votesWeight" BIGINT DEFAULT 0,
 ADD COLUMN "rank" INTEGER DEFAULT 0,
 ADD COLUMN "isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN "u_isDelegate" SMALLINT DEFAULT 0,
 ADD COLUMN "producedblocks" integer DEFAULT 0,
 ADD COLUMN "missedblocks" SMALLINT DEFAULT 0,
 ADD COLUMN "fees" BIGINT DEFAULT 0,
 ADD COLUMN "rewards" BIGINT DEFAULT 0;

COMMIT;