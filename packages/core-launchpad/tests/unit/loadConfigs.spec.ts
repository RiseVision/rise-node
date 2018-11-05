import { expect } from 'chai';
import { configCreator } from '../../src/loadConfigs';
import { CoreModuleStub } from './stubs/CoreModuleStub';

// tslint:disable no-unused-expression
describe('configCreator', () => {
  const oldPWD = process.cwd();
  const nowPwd = `${__dirname}/assets/app/etc/mainnet`;
  before(() => process.chdir(nowPwd));
  after(() => process.chdir(oldPWD));
  it('should load configData from process.pwd if not provided', () => {
    const config = configCreator(null, []);
    // @ts-ignore
    expect(config.testasset).true;
  });
  it('should load configData from provided path', () => {
    expect(() => configCreator(`${nowPwd}/hey.json`, [])).to.throw(
      `${nowPwd}/hey.json`
    );
  });
  it('should query each module .afterConfigValidation', () => {
    const coreModuleStub = new CoreModuleStub();
    const coreModuleStub2 = new CoreModuleStub();
    coreModuleStub.stubs.afterConfigValidation.returns({
      common: true,
      disappear: 'hey',
      first: '1',
    });
    coreModuleStub2.stubs.afterConfigValidation.returns({
      common: true,
      first: '1.1',
      second: 2,
    });
    const config = configCreator(null, [coreModuleStub, coreModuleStub2]);
    expect(config).deep.eq({ common: true, first: '1.1', second: 2 });

    expect(coreModuleStub.stubs.afterConfigValidation.calledOnce).is.true;
    expect(coreModuleStub2.stubs.afterConfigValidation.calledOnce).is.true;
  });
});
