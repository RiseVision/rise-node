import * as Long from 'long';
import {IToFromBufferOpts} from './bignum';

export default class Longnum extends Long {

  public static fromBuffer(buf: Buffer): Long {
    const hex = buf.toString('hex');
    return Longnum.fromString(hex, true, 16);
  }

  public static toBuffer(long: Long, opts: IToFromBufferOpts = {size: 'auto'}) {
    let hex = long.toString(16);

    const size = opts.size === 'auto' ? Math.ceil(hex.length / 2) : (opts.size || 1);

    const len = Math.ceil(hex.length / (2 * size)) * size;
    const buf = new Buffer(len);

    // Zero-pad the hex string so the chunks are all `size` long
    while (hex.length < 2 * len) {
      hex = '0' + hex;
    }

    buf.write(hex, 0, hex.length, 'hex');
    return buf;
  }
}
