// tslint:disable max-line-length
export default {
  sortFields: [
    'id',
    'blockId',
    'amount',
    'fee',
    'type',
    'timestamp',
    'senderPublicKey',
    'senderId',
    'recipientId',
    'confirmations',
    'height',
  ],

  count: 'SELECT COUNT("id")::int AS "count" FROM trs',

  countById: 'SELECT COUNT("id")::int AS "count" FROM trs WHERE "id" = ${id}',

  countList(params) {
    return [
      'SELECT COUNT(1) FROM trs_list',
      (params.where.length ? 'WHERE' : ''),
      (params.where.length ? '(' + params.where.join(' ') + ')' : ''),
    ].filter(Boolean).join(' ');
  },

  list(params) {
    return [
      'SELECT "t_id", "b_height", "t_blockId", "t_type", "t_timestamp", "t_senderId", "t_recipientId",',
      '"t_amount", "t_fee", "t_signature", "t_SignSignature", "t_signatures", "confirmations",',
      'ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey"',
      'FROM trs_list',
      (params.where.length || params.owner ? 'WHERE' : ''),
      (params.where.length ? '(' + params.where.join(' ') + ')' : ''),
      (params.sortField ? 'ORDER BY ' + [params.sortField, params.sortMethod].join(' ') : ''),
      'LIMIT ${limit} OFFSET ${offset}',
    ].filter(Boolean).join(' ');
  },

  getById: 'SELECT *, ENCODE ("t_senderPublicKey", \'hex\') AS "t_senderPublicKey", ENCODE ("m_recipientPublicKey", \'hex\') AS "m_recipientPublicKey" FROM trs_list WHERE "t_id" = ${id}',

  getVotesById: 'SELECT * FROM votes WHERE "transactionId" = ${id}',
};
