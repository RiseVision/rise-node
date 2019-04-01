import { ICrypto, IKeypair } from '@risevision/core-types';
import { api as sodium } from 'sodium';

export class Crypto implements ICrypto {
  /**
   * Creates a keypair given hash.
   */
  public makeKeyPair(hash: Buffer): IKeypair {
    const keypair = sodium.crypto_sign_seed_keypair(hash);

    return {
      privateKey: keypair.secretKey,
      publicKey: keypair.publicKey,
    };
  }

  /**
   * Creates a signature based on a hash and a keypair.
   */
  public sign(hash: Buffer, keypair: IKeypair): Buffer {
    return sodium.crypto_sign_detached(hash, keypair.privateKey);
  }

  /**
   * Verifies a signature based on a hash and a publicKey.
   */
  public verify(
    hash: string | Buffer,
    signature: Buffer,
    publicKey: Buffer
  ): boolean {
    return sodium.crypto_sign_verify_detached(signature, hash, publicKey);
  }
}
