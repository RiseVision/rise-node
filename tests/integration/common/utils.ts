import * as crypto from 'crypto';
import { publicKey } from '../../../src/types/sanityTypes';
import { Ed, IKeypair } from '../../../src/helpers';
const delegates = require('../genesisDelegates.json');
export const findDelegateByPkey = (pk: publicKey): {
  secret: string,
  address: string,
  publicKey: string,
  username: string
} => {
  return delegates.filter((d) => d.keypair.publicKey === pk).pop();
};

export const getKeypairByPkey = (pk: publicKey): IKeypair => {
  const d = findDelegateByPkey(pk);
  if (typeof (d) === 'undefined') {
    throw new Error('cannot find delegate for this pk ' + pk);
  }
  const ed = new Ed();
  return ed.makeKeypair(crypto
    .createHash('sha256').update(d.secret, 'utf8')
    .digest());
};
