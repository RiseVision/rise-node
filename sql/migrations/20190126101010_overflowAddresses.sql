BEGIN;
  -- make these address spendable again.
  update mem_accounts set address = '5R' where address = '97269111055079944786R';
  update mem_accounts set address = '49R' where address = '910097905859080079914R';
COMMIT;