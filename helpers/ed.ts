import {api as sodium} from 'sodium';

export interface IKeypair {
  publicKey: Buffer;
  privateKey: Buffer;
}

/**
 * Generates keypair from hash
 * @param {string} hash
 */
export function makeKeypair(hash: string | Buffer): IKeypair {
  const keypair = sodium.crypto_sign_seed_keypair(hash);

  return {
    privateKey: keypair.secretKey,
    publicKey : keypair.publicKey,
  };
}

/**
 * Creates a signature based on a hash and a keypair.
 */
export function sign(hash: string | Buffer, keypair: IKeypair): Buffer {
  return sodium.crypto_sign_detached(hash, keypair.privateKey);
}

/**
 * Verifies a signature based on a hash and a publicKey.
 */
export function verify(hash: string | Buffer, signature: Buffer, publicKey: Buffer): boolean {
  return sodium.crypto_sign_verify_detached(signature, hash, publicKey);
}
