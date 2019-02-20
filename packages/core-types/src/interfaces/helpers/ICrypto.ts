import { IKeypair } from '../../types';

export interface ICrypto {
  makeKeyPair(hash: Buffer): IKeypair;
  sign(hash: Buffer, keypair: IKeypair): Buffer;
  verify(hash: Buffer, signature: Buffer, publicKey: Buffer): boolean;
}
