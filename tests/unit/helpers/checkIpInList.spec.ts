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
  it('should modify original array to have precomputed subnets key', () => {
    const list = ['1.1.1.1', '10.0.0.0/8'];
    checkIpInList(list, '1.1.2.2');
    expect(list).to.haveOwnProperty('_subNets');
    expect(list['_subNets']).to.be.an('array');
    expect(list['_subNets'].length).to.be.eq(list.length);
  });
});