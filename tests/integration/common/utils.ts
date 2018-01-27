import { publicKey } from '../../../src/types/sanityTypes';
const { delegates } = require('../genesisDelegates.json');
export const findDelegateByPkey = (pk: publicKey): {
  secret: string,
  address: string,
  publicKey: string,
  username: string
} => {
  return delegates.filter((d) => d.publicKey === pk).pop();
};
