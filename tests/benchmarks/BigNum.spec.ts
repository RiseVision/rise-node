import MyBigNumb, { IToFromBufferOpts } from '../../src/helpers/bignum';
import { reportedIT, SimpleMicroSecondTimer } from './benchutils';

describe('MyBigNumber benchmark', function() {
  this.timeout(1000000);

  function genRandBuffer(length): Buffer {
    const buf = Buffer.alloc(length);
    for (let i = 0; i < length; i++) {
      buf[i] = Math.floor(Math.random() * 255);
    }
    return buf;
  }

  function genRandBigNumb(bytes = 1): MyBigNumb {
    const exponent = bytes * 8;
    let toRet;
    toRet = new MyBigNumb(new MyBigNumb(2).exponentiatedBy(exponent).minus(Math.floor(Math.random() * 255)));
    return toRet;
  }

  function testFromBuffer(num: number, bufSize: number, options: IToFromBufferOpts): Promise<number> {
    const ar = new Array(num).fill(genRandBuffer(bufSize));
    const timer = new SimpleMicroSecondTimer();
    timer.start();
    ar.map((buf) => MyBigNumb.fromBuffer(buf, options));
    return Promise.resolve(timer.elapsed() / num);
  }

  function testToBuffer(num: number, bytes: number, options: IToFromBufferOpts): Promise<number> {
    const ar = new Array(num).fill(genRandBigNumb(bytes));
    const timer = new SimpleMicroSecondTimer();
    timer.start();
    ar.map((bn) => bn.toBuffer(options));
    return Promise.resolve(timer.elapsed() / num);
  }

  describe('MyBigNumb.fromBuffer', () => {
    const flavors = [200000];
    reportedIT('[fb fast 8 bytes]', flavors, async (num: number) => {
      return testFromBuffer(num, 8, undefined);
    });

    reportedIT('[fb fast 16 bytes]', flavors, async (num: number) => {
      return testFromBuffer(num, 16, undefined);
    });

    reportedIT('[fb slow 8 bytes, 8 bytes chunk]', flavors, async (num: number) => {
      return testFromBuffer(num, 8, {size: 8});
    });

    reportedIT('[fb slow 8 bytes, 4 bytes chunk]', flavors, async (num: number) => {
      return testFromBuffer(num, 8, {size: 4});
    });

    reportedIT('[fb slow 16 bytes, 8 bytes chunk]', flavors, async (num: number) => {
      return testFromBuffer(num, 16, {size: 8});
    });
  });

  describe('MyBigNumb.toBuffer', () => {
    const flavors = [200000];
    reportedIT('[tb fast 8 bytes]', flavors, async (num: number) => {
      return testToBuffer(num, 8, {size: 8});
    });

    reportedIT('[tb fast 16 bytes]', flavors, async (num: number) => {
      return testToBuffer(num, 16, {size: 16});
    });

    reportedIT('[tb slow 8 bytes, 4 bytes chunk]', flavors, async (num: number) => {
      return testToBuffer(num, 8, {size: 4});
    });

    reportedIT('[tb slow 16 bytes, 8 bytes chunk]', flavors, async (num: number) => {
      return testToBuffer(num, 16, {size: 8});
    });
  });

});
