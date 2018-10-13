import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { GetBlocksRequest } from '../../../src/p2p';
import { ModelSymbols } from '@risevision/core-models';
import { BlocksModel, BlocksModuleUtils, BlocksSymbols } from '../../../src';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { p2pSymbols } from '@risevision/core-p2p';
import { Container } from 'inversify';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('apis/requests/GetBlocksRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: GetBlocksRequest;
  let blocksUtils: BlocksModuleUtils;
  before(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions']);
  });
  beforeEach(() => {
    sandbox.restore();
    instance    = container.getNamed(p2pSymbols.transportMethod, BlocksSymbols.p2p.getBlocks);
    blocksUtils = container.get(BlocksSymbols.modules.utils);
  });

  describe('in/out', () => {
    let sequelizeQueryStub: SinonStub;
    beforeEach(() => {
      const BM = container.getNamed<typeof BlocksModel>(ModelSymbols.model, BlocksSymbols.model);

      sequelizeQueryStub = sandbox.stub(BM.sequelize, 'query');
    });

    async function createRequest(query: any, body: any = null) {
      const resp = await instance.handleRequest(body, query);
      return instance.handleResponse(null, resp);
    }

    it('should fail if request is invalid', async () => {
      await expect(createRequest({})).rejectedWith('query - Missing required property: lastBlockId');
      await expect(createRequest({ lastBlockId: 'a,b' })).rejectedWith('lastBlockId - Object didn\'t pass validation');
      await expect(createRequest({ lastBlockId: '' })).rejected;
      await expect(createRequest({ lastBlockId: null })).rejected;
      expect(sequelizeQueryStub.called).false;
    });
    it('should fail if block does not exist', async () => {
      sequelizeQueryStub.resolves(null);
      await expect(createRequest({ lastBlockId: '10' })).rejectedWith('Block 10 not found!');
      expect(sequelizeQueryStub.calledOnce).true;
      expect(sequelizeQueryStub.firstCall.args[0]).contain('"id" = \'10\'');
    });
    it('should empty array if no further blocks in db', async () => {
      const block = createFakeBlock(container, { previousBlock: { id: '1', height: 100 } as any });
      sequelizeQueryStub.resolves([]);
      sequelizeQueryStub.onFirstCall().resolves(block);

      const st  = sandbox.stub(blocksUtils, 'loadBlocksData').resolves([]);
      const res = await createRequest({ lastBlockId: '10' });
      expect(res).deep.eq({ blocks: [] });
      expect(st.firstCall.args[0]).deep.eq({ lastId: '10', limit: 8378 });
    });

    it('should encode/decode some blocks', async () => {
      const block  = createFakeBlock(container, { previousBlock: { id: '1', height: 100 } as any });
      const block2 = createFakeBlock(container, { previousBlock: block });
      const block3 = createFakeBlock(container, { previousBlock: block2 });
      const block4 = createFakeBlock(container, { previousBlock: block3 });

      sequelizeQueryStub.resolves([]);
      sequelizeQueryStub.onFirstCall().resolves(block);

      sandbox.stub(blocksUtils, 'loadBlocksData').resolves([block2, block3, block4]);
      const res = await createRequest({ lastBlockId: '10' });
      expect(res).deep.eq({ blocks: [block2, block3, block4].map((r) => ({ ...r, relays: 1 })) });
    });


  });
});
