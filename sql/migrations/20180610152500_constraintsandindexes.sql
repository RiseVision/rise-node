BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_accounts_address" on "mem_accounts"("address");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_trs_id" on "trs"("id");

-- TRIGGER TO ensure an existing account (that can only be created by a transaction) cannot go lower than zero
CREATE OR REPLACE FUNCTION proc_balance_check() RETURNS TRIGGER AS $$
  BEGIN
    IF NEW."balance" < 0 OR NEW."u_balance" < 0 THEN
      RAISE EXCEPTION 'Address % cannot go < 0 on balance', NEW.address;
    END IF;
    RETURN NEW;
  END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_memaccounts_update
  BEFORE UPDATE OF balance,u_balance
  on mem_accounts
  FOR EACH ROW EXECUTE PROCEDURE proc_balance_check();


-- TRANSACTIONS amount and fee checks

ALTER table trs
  ADD CONSTRAINT cnst_amount CHECK(amount >= 0),
  ADD CONSTRAINT cnst_fee CHECK(fee >= 0);

COMMIT;

