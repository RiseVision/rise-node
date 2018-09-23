import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { createContainer } from '../../../core-launchpad/tests/utils/createContainer';
import { PostBlockRequest } from '../../src/p2p';
import { p2pSymbols } from '../../../core-p2p/src/helpers';
import { BlocksModel, BlocksSymbols } from '../../src';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { BlocksModuleUtils } from '../../src/modules';
import { Container } from 'inversify';
import { createFakeBlock } from '../utils/createFakeBlocks';
import { createRandomTransactions, toBufferedTransaction } from '../../../core-transactions/tests/utils/txCrafter';
import { SignedAndChainedBlockType } from '../../../core-types/src';
import { Symbols } from '../../../core-interfaces/src';
import { WordPressHookSystem } from 'mangiafuoco';
import { OnReceiveBlock } from '../../src/hooks';
// tslint:disable no-unused-expression
describe('apis/requests/PostBlockRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: PostBlockRequest;
  let blocksUtils: BlocksModuleUtils;
  before(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions']);
  });
  beforeEach(() => {
    sandbox.restore();
    instance    = container.getNamed(p2pSymbols.transportMethod, BlocksSymbols.p2p.postBlock);
    blocksUtils = container.get(BlocksSymbols.modules.utils);
  });

  describe('in/out', () => {
    let sequelizeQueryStub: SinonStub;
    beforeEach(() => {
      const BM = container.getNamed<typeof BlocksModel>(ModelSymbols.model, BlocksSymbols.model);

      sequelizeQueryStub = sandbox.stub(BM.sequelize, 'query');
    });

    async function createRequest(query: any, body: any = null) {
      const r = await instance.createRequestOptions({query, body});
      const resp = await instance.handleRequest(r.data, r.query);
      return instance.handleResponse(null, resp);
    }

    it('should encode/decode some blocks', async () => {
      const hookSystem                          = container.get<WordPressHookSystem>(Symbols.generic.hookSystem);
      const blocks: SignedAndChainedBlockType[] = [];

      blocks.push(createFakeBlock(container, { previousBlock: { id: '1', height: 100 } as any }));
      blocks.push(createFakeBlock(container, { previousBlock: blocks[0] }));
      blocks.push(createFakeBlock(container, { previousBlock: blocks[1] }));
      blocks.push(createFakeBlock(container, {
        previousBlock: blocks[2],
        transactions : createRandomTransactions(3).map(toBufferedTransaction)
      }));

      blocks[3].transactions.forEach((t: any) => {
        t.blockId = blocks[3].id;
        t.relays = 1;
        t.height = blocks[3].height;
        delete t.asset;
      });

      const hookSpy = sandbox.spy(hookSystem, 'do_action');
      for (const b of blocks) {
        await createRequest(null, {block: b});
        expect(hookSpy.calledOnce).true;
        expect(hookSpy.firstCall.args[0]).eq(OnReceiveBlock.name);
        expect(hookSpy.firstCall.args[1]).deep.eq({...b, relays: 1});
        hookSpy.resetHistory();
      }
    });


  });
});
