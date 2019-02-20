import * as crypto from 'crypto';

import { PeerHeaders, SignedAndChainedBlockType } from '../../types';
import { IModule } from './IModule';

export interface ISystemModule extends IModule {
  minVersion: string;
  headers: PeerHeaders;
  readonly broadhash: string;

  getOS(): string;

  getVersion(): string;

  /**
   * Gets private variable `port`
   * @return {number}
   */
  getPort(): number;

  /**
   * Gets private variable `height`
   * @return {number}
   */
  getHeight(): number;

  /**
   * Gets private variable `nethash`
   * @return {hash}
   */
  getNethash(): string;

  /**
   * Gets private variable `nonce`
   * @return {nonce}
   */
  getNonce(): string;

  /**
   * Gets private variable `nethash` and compares with input param.
   * @return {boolean} True if input param is equal to private value.
   */
  networkCompatible(nethash: string): boolean;

  /**
   * Gets private variable `minVersion`
   * @return {string}
   */
  getMinVersion(height?: number): string;

  /**
   * Checks version compatibility from input param against private values.
   * @param {string} version
   * @return {boolean}
   */
  versionCompatible(version): boolean;

  getFees(
    height?: number
  ): {
    fees: {
      [type: string]: bigint;
    };
    fromHeight: number;
    height: number;
    toHeight: number;
  };

  /**
   * Updates private broadhash and height values.
   */
  update(lastBlock: SignedAndChainedBlockType);
}
