import { Address, IKeypair, RiseV2 } from 'dpos-offline';
import * as uuid from 'uuid';

export const generateAccount = (): IKeypair & { address: Address } => {
  const a = RiseV2.deriveKeypair(uuid.v4());
  return {
    ...a,
    address: RiseV2.calcAddress(a.publicKey),
  };
};

export const generateFakeAddress = (): Address => {
  return generateAccount().address;
};

export const generateWallets = (
  howMany: number
): Array<IKeypair & { address: Address }> => {
  const toRet = [];
  for (let i = 0; i < howMany; i++) {
    toRet.push(generateAccount());
  }
  return toRet;
};

export const generateFakeAddresses = (howMany: number): string[] => {
  return generateWallets(howMany).map((a) => a.address);
};
