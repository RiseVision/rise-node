import BigNumber from 'bignumber.js';

export interface IToFromBufferOpts {
  /**
   * Size of the buffer
   */
  size?: 'auto' | number;
  /**
   * Encoding type.
   */
  endian?: 'big' | 'little';
}

export default class MyBigNumb extends BigNumber {
  /**
   * Calculates BigNumber from buffer representation
   * @param {Buffer} buf
   * @param opts
   */
  public static fromBuffer(buf: Buffer, opts: IToFromBufferOpts = {}) {

    const endian = opts.endian || 'big';

    const size = opts.size === 'auto' ? Math.ceil(buf.length) : (opts.size || 1);

    if (buf.length % size !== 0) {
      throw new RangeError('Buffer length (' + buf.length + ')'
        + ' must be a multiple of size (' + size + ')');
    }

    const hex = [];
    for (let i = 0; i < buf.length; i += size) {
      const chunk = [];
      for (let j = 0; j < size; j++) {
        chunk.push(buf[
        i + (endian === 'big' ? j : (size - j - 1))
          ]);
      }

      hex.push(chunk
        .map((c) => `${(c < 16 ? '0' : '')}${c.toString(16)}`)
        .join(''));
    }

    return new BigNumber(hex.join(''), 16);
  }

  /**
   * Exports bignumber to buffer.
   * @returns {Buffer}
   */
  public toBuffer(opts?: IToFromBufferOpts) {
    const endian = opts.endian || 'big';

    let hex = this.toString(16);
    if (hex.charAt(0) === '-') {
      throw new Error('Converting negative numbers to Buffers not supported yet');
    }

    const size = opts.size === 'auto' ? Math.ceil(hex.length / 2) : (opts.size || 1);

    const len = Math.ceil(hex.length / (2 * size)) * size;
    const buf = new Buffer(len);

    // Zero-pad the hex string so the chunks are all `size` long
    while (hex.length < 2 * len) {
      hex = '0' + hex;
    }

    const hx = hex
      .split(new RegExp('(.{' + (2 * size) + '})'))
      .filter((s) => s.length > 0);

    hx.forEach((chunk, i) => {
      for (let j = 0; j < size; j++) {
        const ix = i * size + (endian === 'big' ? j : size - j - 1);
        buf[ix]  = parseInt(chunk.slice(j * 2, j * 2 + 2), 16);
      }
    });

    return buf;
  }
}
