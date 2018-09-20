import { expect } from 'chai';
import { checkIpInList } from '../../../src/helpers';
// tslint:disable no-string-literal no-unused-expression

describe('helpers/checkIpInList', () => {
  it('all false', () => {
    expect(checkIpInList(['127.0.0.1'], '1.1.1.1')).to.be.false;
    expect(checkIpInList(['10.0.0.0/24'], '1.1.1.1')).to.be.false;
    expect(checkIpInList(['10.0.0.0/24', '127.0.0.1'], '1.1.1.1')).to.be.false;
  });
  it('all true', () => {
    expect(checkIpInList(['127.0.0.1'], '127.0.0.1')).to.be.true;
    expect(checkIpInList(['127.0.0.0/24'], '127.0.0.2')).to.be.true;
    expect(checkIpInList(['127.0.0.0/24'], '127.0.0.2')).to.be.true;
    expect(checkIpInList(['10.0.0.0/8', '127.0.0.1'], '10.0.1.2')).to.be.true;
  });
  it('true if the founded ip is v6', () => {
    const list = ['::ffff:127.0.0.1', '10.0.0.0/8'];
    expect(checkIpInList(list, '::ffff:127.0.0.1')).to.be.true;
  });
  it('should throw error if one of list"s ip has invalid subnet', () => {
    expect(() => checkIpInList(['10.0.0.0/24/', '127.0.0.1'], '127.0.0.1'))
      .to.throw('Address 10.0.0.0/24/ is neither v4 or v6');
  });
});
