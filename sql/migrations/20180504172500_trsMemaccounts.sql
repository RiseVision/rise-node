BEGIN;

DROP VIEW IF EXISTS trs_list;

/**
 Update trs table to have height + have constraint on addresses to be uppercase
 */
ALTER TABLE trs
  ADD COLUMN height INT;
UPDATE trs
  SET height = (SELECT height from blocks where blocks.id = trs."blockId");
ALTER TABLE trs
  ALTER COLUMN height SET NOT NULL;


update trs
  set "recipientId" = upper("recipientId"), "senderId" = upper("senderId") where
  "recipientId" <> upper("recipientId") or "senderId" <> upper("senderId");

ALTER TABLE trs
 ADD CONSTRAINT upperAddresses CHECK (upper("recipientId") = "recipientId" and upper("senderId") = "senderId");


/*
 Do the same on mem_accounts
 */
update mem_accounts
  set address = upper(address)
  where address <> upper(address);

ALTER table mem_accounts
  ADD CONSTRAINT upperAddress CHECK(upper("address") = "address");
COMMIT;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounts_address" on "mem_accounts"("address");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_trs_id" on "trs"("id");