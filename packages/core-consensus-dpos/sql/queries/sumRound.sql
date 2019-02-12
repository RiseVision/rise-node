SELECT ARRAY_AGG(r.fee) AS "fees", ARRAY_AGG(r.reward) AS rewards, ARRAY_AGG(r.pk) AS delegates
  FROM (
    SELECT b."totalFee" AS fee, b.reward, b."generatorPublicKey" AS pk
    FROM blocks b
    WHERE CEIL(b.height / :activeDelegates::float)::int = :round
    ORDER BY b.height ASC
  ) r
