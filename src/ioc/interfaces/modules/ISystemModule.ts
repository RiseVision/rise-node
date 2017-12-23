import * as crypto from 'crypto';
import { PeerHeaders } from '../../../types/genericTypes';
import { IModule } from './IModule';

export interface ISystemModule extends IModule {
  minVersion: string;
  headers: PeerHeaders;
  readonly broadhash: string;

  getOS(): void;

  getVersion(): void;

  /**
   * Gets private variable `port`
   * @return {number}
   */
  getPort(): void;

  /**
   * Gets private variable `height`
   * @return {number}
   */
  getHeight(): void;

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

  /**
   * Gets private nethash or creates a new one, based on input param and data.
   * @implements {library.db.query}
   * @implements {crypto.createHash}
   * @param {*} cb
   * @return {hash|setImmediateCallback} err | private nethash or new hash.
   */
  getBroadhash(): Promise<string>;

  getFees(height: number): {
    fees: {
      send: number,
      vote: number,
      secondsignature: number,
      delegate: number,
      multisignature: number,
      dapp
    }, fromHeight: number, height: number, toHeight: number
  };

  /**
   * Updates private broadhash and height values.
   */
  update(): Promise<void>;
}
