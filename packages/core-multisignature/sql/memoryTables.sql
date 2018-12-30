/* Memory Tables
 *
 */

BEGIN;

ALTER TABLE "mem_accounts" ADD COLUMN "multisignatures" bytea[];
ALTER TABLE "mem_accounts" ADD COLUMN "u_multisignatures" bytea[];
ALTER TABLE "mem_accounts" ADD COLUMN "multimin" SMALLINT;
ALTER TABLE "mem_accounts" ADD COLUMN "u_multimin" SMALLINT;
ALTER TABLE "mem_accounts" ADD COLUMN "u_multilifetime" SMALLINT;
ALTER TABLE "mem_accounts" ADD COLUMN "multilifetime" SMALLINT;

CREATE TABLE IF NOT EXISTS "mem_accounts2multisignatures"(
  "accountId" VARCHAR(22) NOT NULL,
  "dependentId" VARCHAR(64) NOT NULL,
  FOREIGN KEY ("accountId") REFERENCES mem_accounts("address") ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS "mem_accounts2u_multisignatures"(
  "accountId" VARCHAR(22) NOT NULL,
  "dependentId" VARCHAR(64) NOT NULL,
  FOREIGN KEY ("accountId") REFERENCES mem_accounts("address") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_mem_accounts2multisignatures_accountId" ON "mem_accounts2multisignatures"("accountId");
CREATE INDEX IF NOT EXISTS "idx_mem_accounts2u_multisignatures_accountId" ON "mem_accounts2u_multisignatures"("accountId");

DELETE FROM "mem_accounts2u_multisignatures";
INSERT INTO "mem_accounts2u_multisignatures" SELECT * FROM "mem_accounts2multisignatures";

COMMIT;
