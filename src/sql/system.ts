// tslint:disable max-line-length

export default {
  getBroadhash: 'SELECT "id" FROM blocks ORDER BY "height" DESC LIMIT ${limit}',
};
