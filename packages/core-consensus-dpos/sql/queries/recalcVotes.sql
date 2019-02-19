UPDATE "mem_accounts" AS m SET "vote" = vote_weight FROM (
  SELECT ma."address", coalesce(SUM(ma3."balance"::bigint),0) AS vote_weight FROM mem_accounts ma
    LEFT JOIN mem_accounts2delegates ma2d ON ma."username" = ma2d."username"
    LEFT JOIN (SELECT balance, address FROM mem_accounts ma2) ma3 on ma3.address = ma2d."address"
  where ma."isDelegate" = 1
  group by ma."address"
) vv
WHERE vv."address"=m."address" AND m."isDelegate"=1;

UPDATE "mem_accounts" AS m SET "votesWeight" = vote_weight FROM (
    SELECT ma."address",
    COALESCE(
      SUM("total_balance"::bigint) *
        (
            CASE WHEN ma.producedblocks + ma.missedblocks < 200
            THEN 1
            ELSE ma.producedblocks::numeric / (ma.producedblocks + ma.missedblocks)
            END
        )::float,
      0
    ) AS vote_weight
        FROM mem_accounts ma
    LEFT JOIN mem_accounts2delegates ma2d
        ON ma."username" = ma2d."username"
    LEFT JOIN
        (SELECT ma_group.divider, floor("balance"::bigint/ ma_group.divider) AS total_balance, ma2."address" AS address
         FROM mem_accounts ma2
            LEFT JOIN (SELECT COUNT("address") as divider, "address" FROM mem_accounts2delegates ma2d GROUP BY "address" ) as ma_group
                ON ma_group."address"=ma2."address"
         WHERE ma_group.divider>0
        ) ma3
        ON ma2d."address"=ma3."address"
    WHERE ma."isDelegate"=1 GROUP BY ma."address"
    ) as vv
WHERE vv."address"=m."address" AND m."isDelegate"=1;
