import * as crypto from 'crypto';
import { inject, injectable, postConstruct } from 'inversify';
import * as os from 'os';
import { IDatabase } from 'pg-promise';
import * as semver from 'semver';
import { constants as constantType } from '../helpers/';
import { IBlocksModule, ISystemModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import sqlSystem from '../sql/system';
import { AppConfig } from '../types/genericTypes';

// tslint:disable-next-line
// tslint:disable-next-line
type PeerHeaders = {
  os: string;
  version: string;
  port: number;
  height: number;
  nethash: string;
  broadhash: string;
  nonce: string;
};
const rcRegExp = /[a-z]+$/;

@injectable()
export class SystemModule implements ISystemModule {
  public minVersion: string;
  public headers: PeerHeaders;
  private lastMinVer: string;
  private minVersionChar: string;

  // Generic and helpers
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  @inject(Symbols.generic.nonce)
  private nonce: string;
  @inject(Symbols.helpers.constants)
  private constants: typeof constantType;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;

  // Modules
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  @postConstruct()
  public postConstruct() {
    this.headers = {
      broadhash: this.appConfig.nethash,
      height   : 1,
      nethash  : this.appConfig.nethash,
      nonce    : this.nonce,
      os       : `${os.platform()}${os.release()}`,
      port     : this.appConfig.port,
      version  : this.appConfig.version,
    };
  }

  public cleanup() {
    return Promise.resolve();
  }

  public getOS() {
    return this.headers.os;
  }

  public getVersion() {
    return this.headers.version;
  }

  /**
   * Gets private variable `port`
   * @return {number}
   */
  public getPort() {
    return this.headers.port;
  }

  /**
   * Gets private variable `height`
   * @return {number}
   */
  public getHeight() {
    return this.headers.height;
  }

  /**
   * Gets private variable `nethash`
   * @return {hash}
   */
  public getNethash() {
    return this.headers.nethash;
  }

  /**
   * Gets private variable `nonce`
   * @return {nonce}
   */
  public getNonce() {
    return this.headers.nonce;
  }

  /**
   * Gets private variable `nethash` and compares with input param.
   */
  public networkCompatible(nethash: string): boolean {
    return this.headers.nethash === nethash;
  }

  /**
   * Gets private variable `minVersion`
   * @return {string}
   */
  public getMinVersion(height: number = this.blocksModule.lastBlock.height) {

    let minVer = '';
    for (let i = this.constants.minVersion.length - 1; i >= 0 && minVer === ''; --i) {
      if (height >= this.constants.minVersion[i].height) {
        minVer = this.constants.minVersion[i].ver;
      }
    }

    // update this.minVersion / this.minVersionChar, if necessary
    if (minVer !== this.lastMinVer) {
      this.lastMinVer = minVer;
      if (rcRegExp.test(minVer)) {
        this.minVersion     = minVer.replace(rcRegExp, '');
        this.minVersionChar = minVer.charAt(minVer.length - 1);
      } else {
        this.minVersion     = minVer;
        this.minVersionChar = '';
      }
    }

    return minVer;
  }

  /**
   * Checks version compatibility from input param against private values.
   * @implements {semver}
   * @param {string} version
   * @return {boolean}
   */
  public versionCompatible(version) {
    this.getMinVersion();		// set current minVersion

    let versionChar;

    if (rcRegExp.test(version)) {
      versionChar = version.charAt(version.length - 1);
      version     = version.replace(rcRegExp, '');
    }

    // if no range specifier is used for minVersion, check the complete version string (inclusive versionChar)
    const rangeRegExp = /[\^~\*]/;
    if (this.minVersionChar && versionChar && !rangeRegExp.test(this.minVersion)) {
      return (version + versionChar) === (this.minVersion + this.minVersionChar);
    }

    // ignore versionChar, check only version
    return semver.satisfies(version, this.minVersion);
  }

  public get broadhash() {
    return this.headers.broadhash;
  }

  /**
   * Gets private nethash or creates a new one, based on input param and data.
   * @implements {library.db.query}
   * @implements {crypto.createHash}
   * @param {*} cb
   * @return {hash|setImmediateCallback} err | private nethash or new hash.
   */
  public async getBroadhash() {
    const rows: Array<{ id: string }> = await this.db.query(sqlSystem.getBroadhash, { limit: 5 });
    if (rows.length <= 1) {
      return this.headers.broadhash;
    }

    const seed = rows.map((r) => r.id).join('');

    const hash = crypto.createHash('sha256').update(seed, 'utf8').digest();
    return hash.toString('hex');
  }

  public getFees(height: number = this.blocksModule.lastBlock.height + 1): {
    fees: {
      send: number,
      vote: number,
      secondsignature: number,
      delegate: number,
      multisignature: number,
      dapp
    }, fromHeight: number, height: number, toHeight: number
  } {

    let i;
    for (i = this.constants.fees.length - 1; i > 0; i--) {
      if (height >= this.constants.fees[i].height) {
        break;
      }
    }

    return {
      fees      : this.constants.fees[i].fees,
      fromHeight: this.constants.fees[i].height,
      height,
      toHeight  : i === this.constants.fees.length - 1 ? null : this.constants.fees[i + 1].height - 1,
    };
  }

  /**
   * Updates private broadhash and height values.
   */
  public async update() {
    this.headers.broadhash = await this.getBroadhash();
    this.headers.height    = this.blocksModule.lastBlock.height;
  }
}
