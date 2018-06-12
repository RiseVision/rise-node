BEGIN;


CREATE TABLE IF NOT EXISTS "info" (
  "key" VARCHAR(20) PRIMARY KEY,
  "value" VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS "exceptions" (
  "type" VARCHAR(10) NOT NULL,
  "key" VARCHAR(255) NOT NULL,
  "remainingCount" INTEGER NOT NULL,
  PRIMARY KEY ("type", "key")
);

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

COMMIT;

