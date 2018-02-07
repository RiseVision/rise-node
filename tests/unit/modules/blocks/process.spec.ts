import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { Container } from 'inversify';
import * as shuffle from 'shuffle-array';
import * as sinon from 'sinon';
import { SinonStub } from 'sinon';
import { TransactionType } from '../../../../src/helpers';
import { IBlocksModuleProcess } from '../../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../../src/ioc/symbols';
import { IBaseTransaction } from '../../../../src/logic/transactions';
import { BlocksModuleChain, BlocksModuleProcess } from '../../../../src/modules/blocks/';
import { BlocksSubmoduleUtilsStub, BusStub, TransactionsModuleStub } from '../../../stubs';
import DbStub from '../../../stubs/helpers/DbStub';
import TransactionLogicStub from '../../../stubs/logic/TransactionLogicStub';
import AccountsModuleStub from '../../../stubs/modules/AccountsModuleStub';
import BlocksModuleStub from '../../../stubs/modules/BlocksModuleStub';
import { RoundsModuleStub } from '../../../stubs/modules/RoundsModuleStub';
import { generateAccounts } from '../../../utils/accountsUtils';
import { createContainer } from '../../../utils/containerCreator';
import { createRandomTransactions, createSendTransaction, createVoteTransaction } from '../../../utils/txCrafter';
import { createRandomWallet } from '../../../integration/common/utils';
import { BlockLogicStub } from '../../../stubs/logic/BlockLogicStub';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/blocks/process', () => {
  let inst: IBlocksModuleProcess;
  let instR: BlocksModuleProcess;
  let container: Container;
  let processExitStub: SinonStub;
  beforeEach(() => {
    container = createContainer(
      Symbols.generic.db,
      Symbols.generic.genesisBlock,

      Symbols.helpers.bus,
      Symbols.helpers.logger,
      Symbols.helpers.sequence,

      Symbols.logic.block,
      Symbols.logic.transaction,

      Symbols.modules.accounts,
      Symbols.modules.blocks,
      Symbols.modules.blocksSubModules.utils,
      Symbols.modules.blocksSubModules.chain,
      Symbols.modules.blocksSubModules.verify,
      Symbols.modules.rounds,
      Symbols.modules.transactions
    );
    container.bind(Symbols.modules.blocksSubModules.chain).to(BlocksModuleChain);
    processExitStub = sinon.stub(process, 'exit');

    inst = instR = container.get(Symbols.modules.blocksSubModules.chain);
  });
  afterEach(() => {
    processExitStub.restore();
  });

  let accountsModule: AccountsModuleStub;
  let blocksModule: BlocksModuleStub;
  let blocksUtils: BlocksSubmoduleUtilsStub;
  let txModule: TransactionsModuleStub;
  let txLogic: TransactionLogicStub;
  let blockLogic: BlockLogicStub;
  let roundsModule: RoundsModuleStub;
  let dbStub: DbStub;
  let busStub: BusStub;
  beforeEach(() => {
    accountsModule = container.get(Symbols.modules.accounts);
    blocksUtils    = container.get(Symbols.modules.blocksSubModules.utils);
    blocksModule   = container.get(Symbols.modules.blocks);
    roundsModule   = container.get(Symbols.modules.rounds);
    txModule       = container.get(Symbols.modules.transactions);
    txLogic        = container.get(Symbols.logic.transaction);
    blockLogic     = container.get(Symbols.logic.block);

    dbStub  = container.get(Symbols.generic.db);
    busStub = container.get(Symbols.helpers.bus);
  });

});
