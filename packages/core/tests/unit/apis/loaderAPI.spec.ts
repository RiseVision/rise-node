import { APISymbols } from '@risevision/core-apis';
import {
  IAppState,
  IBlocksModule,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { CoreSymbols } from '../../../src';
import { LoaderAPI } from '../../../src/apis';
import { LoaderModule } from '../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/loaderAPI', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: LoaderAPI;
  let appState: IAppState;
  let blocksModule: IBlocksModule;
  let loaderModule: LoaderModule;
  let system: ISystemModule;
  let constants;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core',
      'core-helpers',
      'core-crypto',
      'core-accounts',
      'core-transactions',
      'core-blocks',
    ]);

    appState = container.get(Symbols.logic.appState);
    blocksModule = container.get(Symbols.modules.blocks);
    system = container.get(Symbols.modules.system);
    constants = container.get(Symbols.generic.constants);
    loaderModule = container.get(CoreSymbols.modules.loader);

    // loaderModule.loaded    = true;
    blocksModule.lastBlock = { id: 'fakeId', height: 1 } as any;
    system.update(blocksModule.lastBlock);

    instance = container.getNamed(APISymbols.class, CoreSymbols.api.loader);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getStatus', () => {
    it("should return an object with the property 'loaded' equal to true", () => {
      const ret = instance.getStatus();

      expect(ret).to.be.deep.equal({ loaded: true });
    });
  });

  describe('getStatusSync', () => {
    it('should return an object with the properties: broadhash, consensus, height and syncing', () => {
      const appStateGet = sandbox
        .stub(appState, 'get')
        .returns('consensus' as any);

      const ret = instance.getStatusSync();
      expect(appStateGet.firstCall.args.length).to.be.equal(1);
      expect(appStateGet.firstCall.args[0]).to.be.equal('node.consensus');

      expect(ret).to.be.deep.equal({
        broadhash: 'fakeId',
        consensus: 'consensus',
        height: 1,
        syncing: 'consensus',
      });
    });
  });

  describe('ping', () => {
    it('should return false status if this.blocksModule.lastBlock in null', async () => {
      blocksModule.lastBlock = null;

      const ret = await instance.ping();

      expect(ret).to.be.deep.equal({ success: false });
    });

    it('should return true status if secondsAgo < constants.blockReceiptTimeOut', async () => {
      blocksModule.lastBlock.timestamp = 1000000000;

      const ret = await instance.ping();

      expect(ret).to.be.deep.equal({ success: true });
    });

    it('should return false status if secondsAgo >= constants.blockReceiptTimeOut', async () => {
      blocksModule.lastBlock.timestamp = 0;

      const ret = await instance.ping();

      expect(ret).to.be.deep.equal({ success: false });
    });
  });
});
