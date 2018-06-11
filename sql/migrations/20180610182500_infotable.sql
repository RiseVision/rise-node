BEGIN;


CREATE TABLE IF NOT EXISTS "info" (
  "key" VARCHAR(20) PRIMARY KEY,
  "value" VARCHAR(255) NOT NULL
);

CREATE OR REPLACE FUNCTION proc_balance_check() RETURNS TRIGGER AS $$
  BEGIN
    IF NEW."balance" < 0 OR NEW."u_balance" < 0 THEN
      -- IF account is not genesisAccount then raise exception
      IF NOT EXISTS(SELECT * from info where "key" = 'genesisAccount' and "value" = NEW."address") THEN
        RAISE EXCEPTION 'Address % cannot go < 0 on balance: % u_balance: %', NEW.address, NEW."balance", NEW."u_balance";
      END IF;
    END IF;
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;

COMMIT;

