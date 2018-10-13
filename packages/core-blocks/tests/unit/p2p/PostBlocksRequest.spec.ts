import { expect } from 'chai';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { PostBlockRequest } from '../../../src/p2p';
import { p2pSymbols } from '@risevision/core-p2p';
import { BlocksModel, BlocksModule, BlocksModuleProcess, BlocksModuleUtils, BlocksSymbols } from '../../../src';
import { ModelSymbols } from '@risevision/core-models';
import { Container } from 'inversify';
import { createFakeBlock } from '../utils/createFakeBlocks';
import {
  createRandomTransactions,
  toBufferedTransaction
} from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { SignedAndChainedBlockType } from '@risevision/core-types';
import { Symbols } from '@risevision/core-interfaces';
import { WordPressHookSystem } from 'mangiafuoco';
// tslint:disable no-unused-expression
describe('apis/requests/PostBlockRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: PostBlockRequest;
  let blocksUtils: BlocksModuleUtils;
  let blocksModule: BlocksModule;
  let blocksProcess: BlocksModuleProcess;
  let bpOnReceiveBlockStub: SinonStub;
  before(async () => {
    sandbox   = sinon.createSandbox();
    container = await createContainer(['core-blocks', 'core-helpers', 'core', 'core-accounts', 'core-transactions']);
  });
  beforeEach(() => {
    sandbox.restore();
    instance      = container.getNamed(p2pSymbols.transportMethod, BlocksSymbols.p2p.postBlock);
    blocksUtils   = container.get(BlocksSymbols.modules.utils);
    blocksModule  = container.get(BlocksSymbols.modules.blocks);
    blocksProcess = container.get(BlocksSymbols.modules.process);

    blocksModule.lastBlock = { id: '1', height: 100 } as any;
    bpOnReceiveBlockStub   = sandbox.stub(blocksProcess, 'onReceiveBlock').resolves();
  });

  describe('in/out', () => {
    let sequelizeQueryStub: SinonStub;
    beforeEach(() => {
      const BM = container.getNamed<typeof BlocksModel>(ModelSymbols.model, BlocksSymbols.model);

      sequelizeQueryStub = sandbox.stub(BM.sequelize, 'query');
    });

    async function createRequest(query: any, body: any = null) {
      const r    = await instance.createRequestOptions({ query, body });
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
        transactions : createRandomTransactions(3).map(toBufferedTransaction),
      }));

      blocks[3].transactions.forEach((t: any) => {
        t.blockId = blocks[3].id;
        t.relays  = 1;
        t.height  = blocks[3].height;
        delete t.asset;
      });

      for (const b of blocks) {
        await createRequest(null, { block: b });
        expect(bpOnReceiveBlockStub.calledOnce).true;
        expect(bpOnReceiveBlockStub.firstCall.args[0]).deep.eq({ ...b, relays: 1 });
        bpOnReceiveBlockStub.resetHistory();
      }
    });

  });
});
