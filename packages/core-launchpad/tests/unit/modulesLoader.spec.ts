import { expect } from 'chai';
import { fetchCoreModuleImplementations } from '../../src/modulesLoader';

describe('modulesLoader', () => {
  it('should return modules sorted by dependencies', () => {
    const modules = fetchCoreModuleImplementations(
      `${__dirname}/../../../rise`
    );
    expect(modules.map((m) => m.name)).deep.eq([
      '@risevision/core-apis',
      '@risevision/core-crypto',
      '@risevision/core-models',
      '@risevision/core-helpers',
      '@risevision/core-p2p',
      '@risevision/core-transactions',
      '@risevision/core-blocks',
      '@risevision/core',
      '@risevision/core-accounts',
      '@risevision/core-consensus-dpos',
      '@risevision/core-exceptions',
      '@risevision/core-multisignature',
      '@risevision/core-secondsignature',
      '@risevision/rise',
    ]);
  });
});
