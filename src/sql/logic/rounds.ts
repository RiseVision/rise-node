// tslint:disable max-line-length no-trailing-whitespace

export default {
  flush: 'DELETE FROM mem_round WHERE "round" = (${round})::bigint;',

  reCalcVotes: `UPDATE "mem_accounts" AS m SET "vote" = vote_weight FROM (
  SELECT ma."address", coalesce(SUM(ma3."balance"::bigint),0) AS vote_weight FROM mem_accounts ma
    LEFT JOIN mem_accounts2delegates ma2d ON ENCODE(ma."publicKey", 'hex') = ma2d."dependentId"
    LEFT JOIN ( SELECT balance, address FROM mem_accounts ma2) ma3 on ma3.address = ma2d."accountId"
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
        ON ENCODE(ma."publicKey", 'hex')=ma2d."dependentId"
    LEFT JOIN
        (SELECT  ma_group.divider, floor("balance"::bigint/ ma_group.divider) AS total_balance, ma2."address" AS address
         FROM mem_accounts ma2
            LEFT JOIN (SELECT COUNT("accountId") as divider, "accountId" FROM mem_accounts2delegates ma2d  GROUP BY "accountId" ) as ma_group
                ON ma_group."accountId"=ma2."address"
         WHERE ma_group.divider>0
        ) ma3
        ON ma2d."accountId"=ma3."address" 
    WHERE ma."isDelegate"=1 GROUP BY ma."address"
    ) as vv
WHERE vv."address"=m."address" AND m."isDelegate"=1;
`,

  truncateBlocks: 'DELETE FROM blocks WHERE "height" > (${height})::bigint;',

  updateMissedBlocks(backwards: boolean) {
    return [
      'UPDATE mem_accounts SET "missedblocks" = "missedblocks"',
      (backwards ? '- 1' : '+ 1'),
      'WHERE "address" IN ($1:csv);',
    ].join(' ');
  },

  getVotes: 'SELECT d."delegate", d."amount" FROM (SELECT m."delegate", SUM(m."amount") AS "amount", "round" FROM mem_round m GROUP BY m."delegate", m."round") AS d WHERE "round" = (${round})::bigint',

  updateVotes: 'UPDATE mem_accounts SET "vote" = "vote" + (${amount})::bigint WHERE "address" = ${address};',

  updateBlockId: 'UPDATE mem_accounts SET "blockId" = ${newId} WHERE "blockId" = ${oldId};',

  summedRound: 'SELECT SUM(r.fee)::bigint AS "fees", ARRAY_AGG(r.reward) AS rewards, ARRAY_AGG(r.pk) AS delegates FROM (SELECT b."totalFee" AS fee, b.reward, ENCODE(b."generatorPublicKey", \'hex\') AS pk FROM blocks b WHERE CEIL(b.height / ${activeDelegates}::float)::int = ${round} ORDER BY b.height ASC) r;',

  performVotesSnapshot: 'DROP TABLE if exists mem_votes_snapshot; CREATE TABLE mem_votes_snapshot AS SELECT address, vote, "votesWeight" FROM mem_accounts WHERE "isDelegate" = 1',

  restoreVotesSnapshot: 'UPDATE mem_accounts m SET vote = b.vote, "votesWeight" = b."votesWeight" FROM mem_votes_snapshot b WHERE m.address = b.address',
};
