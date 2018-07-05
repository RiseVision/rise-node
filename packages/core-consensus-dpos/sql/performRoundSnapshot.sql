DROP TABLE IF EXISTS mem_round_snapshot;
CREATE TABLE mem_round_snapshot AS TABLE mem_round;
DROP TABLE IF EXISTS mem_votes_snapshot;
CREATE TABLE mem_votes_snapshot AS SELECT address, vote FROM mem_accounts WHERE "isDelegate" = 1;