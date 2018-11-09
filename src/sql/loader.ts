// tslint:disable max-line-length

export default {
  countBlocks: 'SELECT COUNT("rowId")::int FROM blocks',

  getGenesisBlock: 'SELECT "id", "payloadHash", "blockSignature" FROM blocks WHERE "height" = 1',

  countMemAccounts: 'SELECT COUNT(*)::int FROM mem_accounts WHERE "blockId" = (SELECT "id" FROM "blocks" ORDER BY "height" DESC LIMIT 1)',

  getMemRounds: 'SELECT "round" FROM mem_round GROUP BY "round"',

  updateMemAccounts: 'UPDATE mem_accounts SET "u_isDelegate" = "isDelegate", "u_secondSignature" = "secondSignature", "u_username" = "username", "u_balance" = "balance", "u_delegates" = "delegates", "u_multisignatures" = "multisignatures", "u_multimin" = "multimin", "u_multilifetime" = "multilifetime" WHERE "u_isDelegate" <> "isDelegate" OR "u_secondSignature" <> "secondSignature" OR "u_username" <> "username" OR "u_balance" <> "balance" OR "u_delegates" <> "delegates" OR "u_multisignatures" <> "multisignatures" OR "u_multimin" <> "multimin" OR "u_multilifetime" <> "multilifetime";',

  getOrphanedMemAccounts: 'SELECT a."blockId", b."id" FROM mem_accounts a LEFT OUTER JOIN blocks b ON b."id" = a."blockId" WHERE a."blockId" IS NOT NULL AND a."blockId" != \'0\' AND b."id" IS NULL',

  getDelegates: 'SELECT ENCODE("publicKey", \'hex\') FROM mem_accounts WHERE "isDelegate" = 1',

  countDuplicatedDelegates: 'WITH duplicates AS (SELECT COUNT(1) FROM delegates GROUP BY "transactionId" HAVING COUNT(1) > 1) SELECT count(1) FROM duplicates',

  clearVotesSnapshot: 'DROP TABLE IF EXISTS mem_votes_snapshot',

  performVotesSnapshot: 'CREATE TABLE mem_votes_snapshot AS SELECT address, vote, "votesWeight" FROM mem_accounts WHERE "isDelegate" = 1',

  restoreVotesSnapshot: 'UPDATE mem_accounts m SET vote = b.vote, "votesWeight" = b."votesWeight" FROM mem_votes_snapshot b WHERE m.address = b.address',
};
