BEGIN;

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
