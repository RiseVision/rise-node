import { IKeypair } from '@risevision/core-types';

export interface ICrypto {
  makeKeyPair(hash: Buffer): IKeypair;
  sign(hash: Buffer, keypair: IKeypair): IKeypair;
  verify(hash: Buffer, signature: Buffer, publicKey: Buffer): boolean;
}
