DROP TABLE IF EXISTS mem_votes_snapshot;
CREATE TABLE mem_votes_snapshot AS SELECT address, vote FROM mem_accounts WHERE "isDelegate" = 1;
