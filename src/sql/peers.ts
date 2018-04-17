// tslint:disable max-line-length

export default {

  getAll: 'SELECT ip, port, state, os, version, ENCODE(broadhash, \'hex\') AS broadhash, height, clock FROM peers',

  clear: 'DELETE FROM peers',

  truncate: 'TRUNCATE peers CASCADE',

};
