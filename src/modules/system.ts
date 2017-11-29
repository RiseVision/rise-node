import * as crypto from 'crypto';
import * as os from 'os';
import { IDatabase } from 'pg-promise';
import * as semver from 'semver';
import sqlSystem from '../../sql/system';
import { constants, ILogger } from '../helpers/';
import { BlocksModule } from './blocks';
import { TransportModule } from './transport';
// tslint:disable-next-line
type SystemLibrary = { logger: ILogger, db: IDatabase<any>, nonce: any, config: { version: string, port: number, nethash: string } }
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

export class SystemModule {
  public minVersion: string;
  public headers: PeerHeaders;
  public modules: { blocks: BlocksModule, transport: TransportModule };

  private lastMinVer: string;
  private minVersionChar: string;

  constructor(public library: SystemLibrary) {
    this.headers = {
      broadhash: this.library.config.nethash,
      height   : 1,
      nethash  : this.library.config.nethash,
      nonce    : this.library.nonce,
      os       : `${os.platform()}${os.release()}`,
      port     : this.library.config.port,
      version  : this.library.config.version,
    };
  }

  /**
   * Assigns used modules to modules variable.
   */
  public onBind(modules: { blocks: any, transport: any }) {
    this.modules = {
      blocks   : modules.blocks,
      transport: modules.transport,
    };
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
   * @param {hash}
   * @return {boolean} True if input param is equal to private value.
   */
  public networkCompatible(nethash) {
    return this.headers.nethash === nethash;
  }

  /**
   * Gets private variable `minVersion`
   * @return {string}
   */
  public getMinVersion(height: number = this.modules.blocks.lastBlock.height) {

    let minVer = '';
    for (let i = constants.minVersion.length - 1; i >= 0 && minVer === ''; --i) {
      if (height >= constants.minVersion[i].height) {
        minVer = constants.minVersion[i].ver;
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
    const rows: Array<{ id: string }> = await this.library.db.query(sqlSystem.getBroadhash, { limit: 5 });
    if (rows.length <= 1) {
      return this.headers.broadhash;
    }

    const seed = rows.map((r) => r.id).join('');

    const hash = crypto.createHash('sha256').update(seed, 'utf8').digest();
    return hash.toString('hex');
  }

  public getFees(height: number = this.modules.blocks.lastBlock.height + 1): {
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
    for (i = constants.fees.length - 1; i > 0; i--) {
      if (height >= constants.fees[i].height) {
        break;
      }
    }

    return {
      fees      : constants.fees[i].fees,
      fromHeight: constants.fees[i].height,
      height,
      toHeight  : i === constants.fees.length - 1 ? null : constants.fees[i + 1].height - 1,
    };
  }

  /**
   * Updates private broadhash and height values.
   */
  public async update() {
    this.headers.broadhash = await this.getBroadhash();
    this.headers.height    = this.modules.blocks.lastBlock.height;
  }
}
