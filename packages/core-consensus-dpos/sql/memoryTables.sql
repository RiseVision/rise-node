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

ALTER TABLE "mem_accounts" ADD COLUMN IF NOT EXISTS "cmb" INTEGER DEFAULT 0;

ALTER TABLE "mem_accounts" ADD COLUMN IF NOT EXISTS "votesWeight" BIGINT DEFAULT 0;

-- Set votesWeight for existing accounts
UPDATE "mem_accounts" AS m SET "votesWeight" = 0;

UPDATE "mem_accounts" AS m SET "votesWeight" = vote_weight FROM (
    SELECT ma."address",
    COALESCE(
      SUM("total_balance"::bigint) *
        (
            CASE WHEN ma.producedblocks + ma.missedblocks < 200
            THEN 1
            ELSE ma.producedblocks::numeric / (ma.producedblocks + ma.missedblocks)
            END
        )::float ,
      0
    ) AS vote_weight
        FROM mem_accounts ma
    LEFT JOIN mem_accounts2delegates ma2d
        ON ENCODE(ma."publicKey", 'hex')=ma2d."dependentId"
    LEFT JOIN
        (SELECT  ma_group.divider, floor("balance"::bigint/ ma_group.divider) AS total_balance, ma2."address" AS address
         FROM mem_accounts ma2
            LEFT JOIN (SELECT COUNT("accountId") as divider, "accountId" FROM mem_accounts2delegates ma2d  GROUP BY "accountId" ) as ma_group
                ON ma_group."accountId"=ma2."address"
         WHERE ma_group.divider>0
        ) ma3
        ON ma2d."accountId"=ma3."address"
    WHERE ma."isDelegate"=1 GROUP BY ma."address"
    ) as vv
WHERE vv."address"=m."address" AND m."isDelegate"=1;

COMMIT;
