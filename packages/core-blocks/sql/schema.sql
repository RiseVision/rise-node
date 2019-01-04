BEGIN;

CREATE TABLE IF NOT EXISTS "blocks"(
  "id" VARCHAR(255) PRIMARY KEY,
  "rowId" SERIAL NOT NULL,
  "version" INT NOT NULL,
  "timestamp" INT NOT NULL,
  "height" INT NOT NULL,
  "previousBlock" VARCHAR(255),
  "numberOfTransactions" INT NOT NULL,
  "totalAmount" BIGINT NOT NULL,
  "totalFee" BIGINT NOT NULL,
  "reward" BIGINT NOT NULL,
  "payloadLength" INT NOT NULL,
  "payloadHash" bytea NOT NULL,
  "generatorPublicKey" bytea NOT NULL,
  "blockSignature" bytea NOT NULL,
  FOREIGN KEY("previousBlock")
  REFERENCES "blocks"("id") ON DELETE SET NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS "idx_blocks_height" ON "blocks"("height");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_blocks_previousBlock" ON "blocks"("previousBlock");


/* Indexes */
CREATE INDEX IF NOT EXISTS "idx_blocks_rowId" ON "blocks"("rowId");
CREATE INDEX IF NOT EXISTS "idx_blocks_generator_public_key" ON "blocks"("generatorPublicKey");
CREATE INDEX IF NOT EXISTS "idx_blocks_reward" ON "blocks"("reward");
CREATE INDEX IF NOT EXISTS "idx_blocks_numberOfTransactions" ON "blocks"("numberOfTransactions");
CREATE INDEX IF NOT EXISTS "idx_blocks_timestamp" ON "blocks"("timestamp");

COMMIT;
