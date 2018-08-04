import { fetchCoreModuleImplementations } from '../src/modulesLoader';
import * as appModulePath from 'app-module-path';
import { SinonStub } from 'sinon';
import {expect} from 'chai';
import * as sinon from 'sinon';

describe('modulesLoader', () => {
  it('should return modules sorted by dependencies', () => {
    const modules = fetchCoreModuleImplementations( `${__dirname}/../../rise`);
    expect(modules.map((m) => m.name)).deep.eq([
      '@risevision/core-models',
      '@risevision/core-p2p',
      '@risevision/core-apis',
      '@risevision/core-exceptions',
      '@risevision/core-transactions',
      '@risevision/core-blocks',
      '@risevision/core',
      '@risevision/core-consensus-dpos',
      '@risevision/core-accounts',
      '@risevision/core-multisignature',
      '@risevision/core-secondsignature']);

  });
});
