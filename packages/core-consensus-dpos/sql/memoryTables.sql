BEGIN;
CREATE TABLE IF NOT EXISTS "mem_round"(
  "address" VARCHAR(22),
  "amount" BIGINT,
  "delegate" VARCHAR(64),
  "blockId" VARCHAR(20),
  "round" BIGINT
);

CREATE INDEX IF NOT EXISTS "mem_round_address" ON "mem_round"("address");
CREATE INDEX IF NOT EXISTS "mem_round_round" ON "mem_round"("round");

CREATE TABLE IF NOT EXISTS "mem_accounts2delegates"(
  "accountId" VARCHAR(22) NOT NULL,
  "dependentId" VARCHAR(64) NOT NULL,
  FOREIGN KEY ("accountId") REFERENCES mem_accounts("address") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "mem_accounts2delegates_accountId" ON "mem_accounts2delegates"("accountId");

CREATE TABLE IF NOT EXISTS "mem_accounts2u_delegates"(
  "accountId" VARCHAR(22) NOT NULL,
  "dependentId" VARCHAR(64) NOT NULL,
  FOREIGN KEY ("accountId") REFERENCES mem_accounts("address") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "mem_accounts2u_delegates_accountId" ON "mem_accounts2u_delegates"("accountId");

DELETE FROM "mem_accounts2u_delegates";
INSERT INTO "mem_accounts2u_delegates" SELECT * FROM "mem_accounts2delegates";
COMMIT;
