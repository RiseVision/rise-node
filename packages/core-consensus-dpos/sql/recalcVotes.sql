UPDATE "mem_accounts" AS m SET "vote" = vote_weight FROM (
  SELECT ma."address", coalesce(SUM(ma3."balance"::bigint),0) AS vote_weight FROM mem_accounts ma
    LEFT JOIN mem_accounts2delegates ma2d ON ENCODE(ma."publicKey", 'hex') = ma2d."dependentId"
    LEFT JOIN ( SELECT balance, address FROM mem_accounts ma2) ma3 on ma3.address = ma2d."accountId"
  where ma."isDelegate" = 1
  group by ma."address"
) vv
WHERE vv."address"=m."address" AND m."isDelegate"=1;
