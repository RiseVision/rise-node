import { publicKey } from '../../../types/sanityTypes';
import { IKeypair } from '../../../helpers';

export interface IForgeModule {
  /**
   * enable forging for specific pk or all if pk is undefined
   */
  enableForge(pk?: publicKey | IKeypair): void;

  /**
   * disable forging for specific pk or all if pk is undefined
   */
  disableForge(pk?: publicKey): void;
}