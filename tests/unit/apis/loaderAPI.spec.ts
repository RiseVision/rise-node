import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { LoaderAPI } from '../../../src/apis';
import { Symbols } from '../../../src/ioc/symbols';
import {
  AppStateStub,
  BlocksModuleStub,
  SystemModuleStub,
} from '../../stubs';
import { LoaderModuleStub } from '../../stubs/modules/LoaderModuleStub';
import { createContainer } from '../../utils/containerCreator';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/loaderAPI', () => {

  let sandbox: SinonSandbox;
  let container: Container;
  let instance: LoaderAPI;
  let appState: AppStateStub;
  let blocksModule: BlocksModuleStub;
  let loaderModule: LoaderModuleStub;
  let system: SystemModuleStub;
  let constants;

  beforeEach(() => {
    sandbox   = sinon.createSandbox();
    container = createContainer();
    container.bind(Symbols.api.loader).to(LoaderAPI);

    appState     = container.get(Symbols.logic.appState);
    blocksModule = container.get(Symbols.modules.blocks);
    system       = container.get(Symbols.modules.system);
    constants    = container.get(Symbols.helpers.constants);
    loaderModule = container.get(Symbols.modules.loader);

    loaderModule.loaded    = true;
    blocksModule.lastBlock = { height: 1 } as any;

    instance = container.get(Symbols.api.loader);
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
      appState.enqueueResponse('get', 'consensus');

      const ret = instance.getStatusSync();

      expect(appState.stubs.get.calledOnce).to.be.true;
      expect(appState.stubs.get.firstCall.args.length).to.be.equal(1);
      expect(appState.stubs.get.firstCall.args[0]).to.be.equal('node.consensus');

      expect(ret).to.be.deep.equal({
        broadhash: undefined,
        consensus: 'consensus',
        height   : 1,
        syncing  : undefined,
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
