import { expect } from 'chai';
import 'reflect-metadata';
import { toTransportable } from '../../src';
// tslint:disable no-unused-expression
describe('helpers/transportTransformer', () => {
  it('no manipulation on nested plain primitives', () => {
    const obj = {
      a: 1,
      b: 'hey',
      c: {
        a: '1',
        b: ['a', 'c'],
      },
      d: null,
    };
    expect(
      toTransportable({
        ...obj,
        e: undefined,
        asd() {
          return 'ciao';
        },
      })
    ).deep.eq(obj);
  });
  it('should convert bigint to string', () => {
    const obj = { a: 1n };
    expect(toTransportable(obj)).deep.eq({ a: '1' });
  });
  it('should not modify original obj', () => {
    const obj = { a: 1n };
    expect(toTransportable(obj)).deep.eq({ a: '1' });
    expect(obj).deep.eq({ a: 1n });
  });
  it('should convert buffers', () => {
    const obj = { a: Buffer.from('aa', 'hex') };
    expect(toTransportable(obj)).deep.eq({ a: 'aa' });

    expect(
      toTransportable({
        a: [Buffer.from('aa', 'hex'), Buffer.from('bb', 'hex')],
        b: {
          a: Buffer.from('aabb', 'hex'),
        },
      })
    ).deep.eq({
      a: ['aa', 'bb'],
      b: { a: 'aabb' },
    });
  });
  it('should work with array', () => {
    expect(toTransportable([Buffer.from('aa', 'hex'), 1n, 'meow'])).deep.eq([
      'aa',
      '1',
      'meow',
    ]);

    expect(toTransportable([])).deep.eq([]);
  });

  it('should throw if max recursion exhausted', () => {
    expect(() => toTransportable({ a: '1' }, 1)).to.throw;
    expect(() => toTransportable({ a: '1' }, 2)).to.not.throw;
    expect(() => toTransportable({ a: '1', b: [] }, 2)).to.throw;
    expect(() => toTransportable('a', 1)).to.not.throw;
    expect(() => toTransportable('a', 0)).to.not.throw;
  });
});
