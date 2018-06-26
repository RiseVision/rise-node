import { dposOffline } from 'dpos-offline';
import * as uuid from 'uuid';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';

export const generateAccount = (): LiskWallet => {
  return new dposOffline.wallets.LiskLikeWallet(uuid.v4(), 'R');
};

export const generateFakeAddress = (): string => {
  return generateAccount().address;
};

export const generateAccounts = (howMany: number): LiskWallet[] => {
  const toRet = [];
  for (let i = 0; i < howMany; i++) {
    toRet.push(generateAccount());
  }
  return toRet;
};

export const generateFakeAddresses = (howMany: number): string[] => {
  return generateAccounts(howMany).map((a) => a.address);
};