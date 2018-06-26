import { IKeypair, publicKey } from '@risevision/core-types';

export interface IForgeModule {
  /**
   * Returns the enabled publicKeys
   * @return {string[]}
   */
  getEnabledKeys(): publicKey[];
  /**
   * Checks if publicKey is enabled to forge
   * @return boolean true if forging is enabled for such pk false otherwise
   */
  isForgeEnabledOn(pk?: publicKey | IKeypair): boolean;
  /**
   * enable forging for specific pk or all if pk is undefined
   */
  enableForge(kp?: IKeypair): void;

  /**
   * disable forging for specific pk or all if pk is undefined
   */
  disableForge(pk?: publicKey): void;
}
