import { expect } from 'chai';
import {
  createRandomAccountsWithFunds, createRandomAccountWithFunds,
  createRegDelegateTransaction, createSecondSignTransaction, createVoteTransaction,
  easyCreateMultiSignAccount
} from '../common/utils';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { BlocksModule, RoundsModule } from '../../../src/modules';
import initializer from '../common/init';
import { Symbols } from '../../../src/ioc/symbols';
import { BlocksModuleChain } from '../../../src/modules/blocks/';
import { toBufferedTransaction } from '../../utils/txCrafter';
import constants from '../../../src/helpers/constants';
import { RoundsLogic } from '../../../src/logic';
import { AccountsModel } from '../../../src/models';

describe('blockProcessing', async () => {
  let blocksModule: BlocksModule;
  let blocksChainModule: BlocksModuleChain;
  let senderAccount: LiskWallet;
  before(() => {
    constants.activeDelegates = 101;
    constants.dposv2.firstBlock = 102;
  });
  after(() => {
    constants.activeDelegates = 101;
  });
  initializer.setup();
  beforeEach(async () => {

    blocksModule      = initializer.appManager.container.get(Symbols.modules.blocks);
    blocksChainModule = initializer.appManager.container.get(Symbols.modules.blocksSubModules.chain);
    const {wallet: randomAccount} = await createRandomAccountWithFunds(Math.floor(108910891000000/3));
    senderAccount                 = randomAccount;
    const tx = await createRegDelegateTransaction(0, senderAccount, 'user1');
    await initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)]);
    await createVoteTransaction(1, senderAccount, senderAccount.publicKey, true);
  });
  initializer.createBlocks(20 * 10, 'single');
  // initializer.autoRestoreEach();
  it ('ciao', async () => {
    const b: BlocksModule = initializer.appManager.container.get(Symbols.modules.blocks);

    const rl = initializer.appManager.container.get<RoundsLogic>(Symbols.logic.rounds);
    console.log(b.lastBlock);
    console.log(rl.calcRound(b.lastBlock.height));
    const am = initializer.appManager.container.get<typeof AccountsModel>(Symbols.models.accounts);
    const accData = await am.findById(senderAccount.address);
    console.log(accData);

  });

});
