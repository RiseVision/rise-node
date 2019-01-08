BEGIN;
CREATE TABLE IF NOT EXISTS mem_accounts (
    address character varying(250) NOT NULL PRIMARY KEY,
    balance bigint DEFAULT 0,
    u_balance bigint DEFAULT 0,
    virgin smallint DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mem_accounts_address" on "mem_accounts"("address");

DROP TRIGGER IF EXISTS "trg_memaccounts_update" on "mem_accounts";
DROP FUNCTION IF EXISTS fn_mem_accounts_protect;

CREATE FUNCTION fn_mem_accounts_protect() RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN
  -- Check Address did not change.
  IF NEW."address" <> OLD."address" THEN
    RAISE EXCEPTION 'Address % cannot be changed to %', NEW."address", OLD."address";
  END IF;
  -- check balance going < 0
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

END $$;


CREATE TRIGGER trg_memaccounts_update
  BEFORE UPDATE OF "address","balance","u_balance" ON "mem_accounts" FOR EACH ROW
  EXECUTE PROCEDURE fn_mem_accounts_protect();


COMMIT;
