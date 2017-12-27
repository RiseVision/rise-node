export default {
  // tslint:disable-next-line max-line-length
  getAccountIds: 'SELECT ARRAY_AGG("accountId") AS "accountIds" FROM mem_accounts2multisignatures WHERE "dependentId" = ${publicKey}',
};
