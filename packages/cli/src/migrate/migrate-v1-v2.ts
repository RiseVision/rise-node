// tslint:disable:max-line-length
export const sql = `
BEGIN;

-- make these address spendable again.
update mem_accounts set address = '5R' where address = '97269111055079944786R';
update mem_accounts set address = '49R' where address = '910097905859080079914R';
update trs set "recipientId" = '5R' where "recipientId" = '97269111055079944786R';
update trs set "recipientId" = '49R' where "recipientId" = '910097905859080079914R';

DROP view IF EXISTS trs_list;
drop view IF EXISTS blocks_list;
drop view IF EXISTS full_blocks_list;

ALTER TABLE blocks
	ALTER COLUMN id TYPE VARCHAR(250),
	alter column "previousBlock" type VARCHAR(250);

ALTER TABLE peers
	ALTER COLUMN "broadhash" TYPE VARCHAR(255);

DROP TABLE IF EXISTS dapps;
DROP TABLE IF EXISTS forks_stat;
DROP TABLE IF EXISTS intransfer;
DROP TABLE IF EXISTS mem_round;
DROP TABLE IF EXISTS mem_round_snapshot;
DROP TABLE IF EXISTS migrations;
DROP TABLE IF EXISTS multisignatures;
DROP TABLE IF EXISTS outtransfer;
DROP TABLE IF EXISTS peers_dapp;

ALTER TABLE "trs" RENAME TO "trs_old";

CREATE TABLE IF NOT EXISTS "trs"(
  "id" VARCHAR(255) PRIMARY KEY,
  "rowId" SERIAL NOT NULL,
  "blockId" VARCHAR(255) NOT NULL,
  "height" INTEGER NOT NULL,
  "type" SMALLINT NOT NULL,
  "timestamp" INT NOT NULL,
  "senderPubData" bytea NOT NULL,
  "senderId" VARCHAR(255) NOT NULL,
  "recipientId" VARCHAR(255),
  "amount" BIGINT NOT NULL,
  "fee" BIGINT NOT NULL,
  "signatures" bytea[] NOT NULL,
  "version" SMALLINT NOT NULL,
  FOREIGN KEY("blockId") REFERENCES "blocks"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "trsassets_send" (
  "data" bytea,
  "transactionId" VARCHAR(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_trs_block_id" ON "trs"("blockId");
CREATE INDEX IF NOT EXISTS "idx_trs_sender_id" ON "trs"("senderId");
CREATE INDEX IF NOT EXISTS "idx_trs_recipient_id" ON "trs"("recipientId");
CREATE INDEX IF NOT EXISTS "idx_trs_type" ON "trs"("type");
CREATE INDEX IF NOT EXISTS "idx_trs_timestamp" ON "trs"("timestamp");

insert into "trs"
	// tslint:disable-next-line:max-line-length
	("id", "blockId", "height", "type", "timestamp", "senderPubData", "senderId", "recipientId", "amount", "fee", "signatures", "version")
	SELECT trs_old.id, trs_old."blockId", height, type, trs_old."timestamp", "senderPublicKey", "senderId", "recipientId", "amount", "fee",
		case when "signSignature" is null
		then array [ "signature" ]
		else array [ "signature", "signSignature"]
		end
	as "signatures", 0 FROM "trs_old"
	order by trs_old."rowId" asc;


CREATE TABLE IF NOT EXISTS "trsassets_delegates" (
  "username" character varying(20) UNIQUE,
  "forgingPK" bytea NOT NULL UNIQUE,
  "transactionId" character varying(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);


INSERT INTO trsassets_delegates
	SELECT username, "senderPubData" as forgingPK, "transactionId" FROM delegates
		LEFT JOIN "trs" ON "trs"."id" = "transactionId";

DROP table delegates;

CREATE TABLE IF NOT EXISTS "trsassets_votes_old" (
  "votes" TEXT,
  "transactionId" VARCHAR(250) NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES "trs"("id") ON DELETE CASCADE
);

INSERT INTO "trsassets_votes_old"
	SELECT * from "votes";

DROP table votes;

DROP table mem_accounts2multisignatures;
DROP table mem_accounts2u_multisignatures;

CREATE TABLE IF NOT EXISTS "tmp_memaccts_delegates" (
  "address" character varying(250) NOT NULL,
  "username" character varying(20) NOT NULL
);

INSERT INTO "tmp_memaccts_delegates"
	SELECT "accountId" as "address", username from "mem_accounts2delegates"
	LEFT JOIN mem_accounts as ma ON ENCODE(ma."publicKey", 'hex') = "dependentId";

DROP TABLE "mem_accounts2delegates";
DROP TABLE "mem_accounts2u_delegates";

ALTER TABLE "tmp_memaccts_delegates" RENAME TO mem_accounts2delegates;

ALTER TABLE "signatures" RENAME TO "old_secondsignature";

CREATE TABLE IF NOT EXISTS "trsassets_secondsignature"(
  "transactionId" VARCHAR(20) NOT NULL PRIMARY KEY,
  "publicKey" bytea NOT NULL,
  FOREIGN KEY("transactionId") REFERENCES trs(id) ON DELETE CASCADE
);

INSERT INTO "trsassets_secondsignature"
	SELECT * from "old_secondsignature";

DROP TABLE "old_secondsignature";

DROP TABLE "trs_old";

ALTER TABLE mem_accounts
	DROP column "blockId",
	DROP column "delegates",
	DROP column "u_delegates",
	DROP column "multisignatures",
	DROP column "u_multisignatures",
	DROP column "rate",

	DROP column "multimin",
	DROP column "u_multimin",
	DROP column "multilifetime",
	DROP column "u_multilifetime",
	DROP column "nameexist",
	DROP column "u_nameexist",
	ALTER column "address" type VARCHAR(255);

alter table mem_accounts
	RENAME column "publicKey" to "forgingPK";

UPDATE mem_accounts ma
  SET "forgingPK" = NULL
  WHERE ma."isDelegate" = 0;

COMMIT;
`;
