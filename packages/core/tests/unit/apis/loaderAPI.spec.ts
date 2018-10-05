import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { LoaderAPI } from '../../../src/apis';
import { IAppState, IBlocksModule, ISystemModule, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '../../../../core-launchpad/tests/utils/createContainer';
import { APISymbols } from '@risevision/core-apis';
import { LoaderModule } from '../../../src/modules';
import { CoreSymbols } from '../../../src';

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
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core', 'core-helpers', 'core-accounts']);

    appState     = container.get(Symbols.logic.appState);
    blocksModule = container.get(Symbols.modules.blocks);
    system       = container.get(Symbols.modules.system);
    constants    = container.get(Symbols.generic.constants);
    loaderModule = container.get(CoreSymbols.modules.loader);

    // loaderModule.loaded    = true;
    blocksModule.lastBlock = { height: 1 } as any;

    instance = container.getNamed(APISymbols.api, CoreSymbols.api.loader);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getStatus', () => {

    it('should return an object with the property \'loaded\' equal to true', () => {
      const ret = instance.getStatus();

      expect(ret).to.be.deep.equal({ loaded: true });
    });

  });

  describe('getStatusSync', () => {

    it('should return an object with the properties: broadhash, consensus, height and syncing', () => {
      const appStateGet = sandbox.stub(appState, 'get').returns('consensus');

      const ret = instance.getStatusSync();
      expect(appStateGet.firstCall.args.length).to.be.equal(1);
      expect(appStateGet.firstCall.args[0]).to.be.equal('node.consensus');

      expect(ret).to.be.deep.equal({
        broadhash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
        consensus: 'consensus',
        height   : 1,
        syncing  : 'consensus',
      });
    });

  });

  describe('ping', () => {

    it('should return false status if this.blocksModule.lastBlock in null', () => {
      blocksModule.lastBlock = null;

      const ret = instance.ping();

      expect(ret).to.be.deep.equal({ success: false });
    });

    it('should return true status if secondsAgo < constants.blockReceiptTimeOut', () => {
      blocksModule.lastBlock.timestamp = 1000000000;

      const ret = instance.ping();

      expect(ret).to.be.deep.equal({ success: true });
    });

    it('should return false status if secondsAgo >= constants.blockReceiptTimeOut', () => {
      blocksModule.lastBlock.timestamp = 0;

      const ret = instance.ping();

      expect(ret).to.be.deep.equal({ success: false });
    });
  });
});
