BEGIN;
CREATE TABLE mem_accounts (
    address character varying(250) NOT NULL,
    balance bigint DEFAULT 0,
    u_balance bigint DEFAULT 0,
    virgin smallint DEFAULT 1
);
COMMIT;
