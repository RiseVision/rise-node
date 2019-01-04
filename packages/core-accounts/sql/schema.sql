BEGIN;
CREATE TABLE IF NOT EXISTS mem_accounts (
    address character varying(250) NOT NULL,
    balance bigint DEFAULT 0,
    u_balance bigint DEFAULT 0,
    virgin smallint DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mem_accounts_address" on "mem_accounts"("address");

CREATE OR REPLACE FUNCTION proc_balance_check() RETURNS TRIGGER AS $$
  BEGIN
    IF NEW."balance" < 0 OR NEW."u_balance" < 0 THEN
      -- IF account is not genesisAc
      -- count then raise exception
      IF NOT EXISTS(SELECT * from info where "key" = 'genesisAccount' and "value" = NEW."address") THEN
        -- CHECK IF account is among an exception
        RAISE WARNING 'Account % Running through exceptions', NEW.address;
        IF EXISTS (SELECT * from exceptions where "type" = 'account' AND "key" = NEW."address" AND "remainingCount" > 0) THEN
          UPDATE exceptions SET "remainingCount" = "remainingCount" - 1 where "type" = 'account' AND "key" = NEW."address";
        ELSE
          RAISE EXCEPTION 'Address % cannot go < 0 on balance: % u_balance: %', NEW.address, NEW."balance", NEW."u_balance";
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;

-- This file needs to be indepotent. So I delete trigger if it already exists
DROP TRIGGER IF EXISTS trg_memaccounts_update on mem_accounts;

CREATE TRIGGER trg_memaccounts_update
  BEFORE UPDATE OF balance,u_balance
  on mem_accounts
  FOR EACH ROW EXECUTE PROCEDURE proc_balance_check();

COMMIT;
