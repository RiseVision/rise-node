import { expect } from 'chai';
import * as sinon from 'sinon';
import { OrderBy } from '../../src';

// tslint:disable no-unused-expression
describe('helpers/orderBy', () => {
  it('should return fn', () => {
    const r = OrderBy('bit:asc');
    expect(r).is.a('function');
  });

  it('should sort numeric', () => {
    const orig = [{ a: 1 }, { a: 3 }, { a: 2 }];
    expect(OrderBy('a:asc')(orig)).deep.eq([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(OrderBy('a:desc')(orig)).deep.eq([{ a: 3 }, { a: 2 }, { a: 1 }]);
  });

  it('should sort bigint', () => {
    const orig = [{ a: 1n }, { a: 3n }, { a: 2n }];
    expect(OrderBy('a:asc')(orig)).deep.eq([{ a: 1n }, { a: 2n }, { a: 3n }]);
    expect(OrderBy('a:desc')(orig)).deep.eq([{ a: 3n }, { a: 2n }, { a: 1n }]);
  });

  it('should sort string', () => {
    const orig = [{ a: '1' }, { a: '3' }, { a: '2' }];
    expect(OrderBy('a:asc')(orig)).deep.eq([
      { a: '1' },
      { a: '2' },
      { a: '3' },
    ]);
    expect(OrderBy('a:desc')(orig)).deep.eq([
      { a: '3' },
      { a: '2' },
      { a: '1' },
    ]);
  });

  it('should sort buffers', () => {
    const one = Buffer.alloc(1).fill(0x1);
    const two = Buffer.alloc(1).fill(0x2);
    const three = Buffer.alloc(1).fill(0x3);
    const orig = [{ a: one }, { a: three }, { a: two }];
    expect(OrderBy('a:asc')(orig)).deep.eq([
      { a: one },
      { a: two },
      { a: three },
    ]);
    expect(OrderBy('a:desc')(orig)).deep.eq([
      { a: three },
      { a: two },
      { a: one },
    ]);
  });

  it('should not touch original array', () => {
    const orig = [{ a: 1 }, { a: 3 }, { a: 2 }];
    const d = OrderBy('a:asc')(orig);
    expect(d).not.deep.eq(orig);
  });

  it('should order asc default', () => {
    const orig = [{ a: 1 }, { a: 3 }, { a: 2 }];
    const d = OrderBy('a')(orig);
    expect(d).deep.eq([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('should throw if unsortable', () => {
    const orig = [{ a: () => 1 }, { a: () => 3 }, { a: () => 2 }];
    expect(() => OrderBy('a')(orig)).to.throw('Uncomparable a');
  });
});
