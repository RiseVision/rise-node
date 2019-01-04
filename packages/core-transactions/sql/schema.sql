BEGIN;

CREATE TABLE IF NOT EXISTS "trs"(
  "id" VARCHAR(255) PRIMARY KEY,
  "rowId" SERIAL NOT NULL,
  "blockId" VARCHAR(255) NOT NULL,
  "type" SMALLINT NOT NULL,
  "timestamp" INT NOT NULL,
  "senderPublicScript" bytea NOT NULL,
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

COMMIT;
