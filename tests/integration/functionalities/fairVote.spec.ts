import { expect } from 'chai';
import {
  addNewDelegate,
  createRandomAccountWithFunds,
  createRegDelegateTransaction,
  createVoteTransaction,
  createWallet,
  removeDelegatePass,
} from '../common/utils';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import { BlocksModule } from '../../../src/modules';
import initializer from '../common/init';
import { Symbols } from '../../../src/ioc/symbols';
import { toBufferedTransaction } from '../../utils/txCrafter';
import constants from '../../../src/helpers/constants';
import { AccountsModel } from '../../../src/models';
import * as uuid from 'uuid';

describe('Fair vote system', async () => {
  let blocksModule: BlocksModule;
  let accountsModel: typeof AccountsModel;
  let newDelegateWallet: LiskWallet;
  const dposv2FirstBlock = constants.dposv2.firstBlock;
  before(() => {
    // Start with dposv2 algorithm afer the first round.
    constants.dposv2.firstBlock = constants.activeDelegates + 1;
  });
  after(() => {
    constants.dposv2.firstBlock = dposv2FirstBlock;
  });
  initializer.setup();
  beforeEach(async () => {
    blocksModule  = initializer.appManager.container.get(Symbols.modules.blocks);
    accountsModel = initializer.appManager.container.get<typeof AccountsModel>(Symbols.models.accounts);
    // Each Delegate has a genesis balance of 108910891000000 and voted for himself. We transfer 1 third of balance
    // of a random genesis delegate to a new account that will vote for himself. This will give enough funds to increase
    // the forging chances, but not with normal dpos algorithm.
    const secret      = uuid.v4();
    newDelegateWallet = createWallet(secret);
    await createRandomAccountWithFunds(Math.floor(108910891000000 / 3), newDelegateWallet);
    addNewDelegate({
      address : newDelegateWallet.address,
      keypair : {
        privateKey: newDelegateWallet.privKey,
        publicKey : newDelegateWallet.publicKey,
      },
      secret,
      username: 'outsider',
    });
    const tx = await createRegDelegateTransaction(0, newDelegateWallet, 'outsider');
    await initializer.rawMineBlockWithTxs([toBufferedTransaction(tx)]);
    await createVoteTransaction(1, newDelegateWallet, newDelegateWallet.publicKey, true);
  });
  afterEach(async () => {
    removeDelegatePass(newDelegateWallet.address);
    await initializer.rawDeleteBlocks(3);
  });

  it('should at some point include an outsider in round, when dposv2 is active', async function () {
    this.timeout(1000000);
    let minedBlocks = 0;
    let found       = false;
    const acc       = await accountsModel.findById(newDelegateWallet.address);
    // Make sure the bew delegate hasn't forget yet
    expect(blocksModule.lastBlock.height).to.be.lt(constants.activeDelegates);
    expect(acc).not.to.be.undefined;
    expect(acc.producedblocks).to.be.equal(0);
    expect(acc.votesWeight).to.be.equal(0);

    // We assume it takes less than 100 rounds to include the outsider in forging.
    while (minedBlocks < 100 * constants.activeDelegates) {
      const howMany = minedBlocks === 0 ?
        constants.activeDelegates - blocksModule.lastBlock.height : constants.activeDelegates;
      await initializer.rawMineBlocks(howMany);
      minedBlocks += howMany;
      const accData = await accountsModel.findById(newDelegateWallet.address);
      if (accData.producedblocks > 0) {
        found = true;
        break;
      }
      if (blocksModule.lastBlock.height > constants.activeDelegates) {
        expect(accData.vote).to.be.equal(accData.balance);
      }
    }
    await initializer.rawDeleteBlocks(minedBlocks);
    expect(found).to.be.true;
  });

  it('should reduce votesWeight for delegates with productivity lower than 100%', async function () {
    this.timeout(1000000);
    let blocksToDelete        = 0;
    const blocksToFinishRound = constants.activeDelegates - blocksModule.lastBlock.height;
    await initializer.rawMineBlocks(blocksToFinishRound);
    blocksToDelete += blocksToFinishRound;
    const acc                = await accountsModel.findById(newDelegateWallet.address);
    const initialVotesWeight = acc.votesWeight;
    expect(initialVotesWeight).to.be.equal(acc.balance);
    acc.set('producedblocks', 200);
    acc.set('missedblocks', 201);
    await acc.save();
    let accAfter = acc;
    while (accAfter.producedblocks <= 200) {
      await initializer.rawMineBlocks(constants.activeDelegates);
      blocksToDelete += constants.activeDelegates;
      accAfter = await accountsModel.findById(newDelegateWallet.address);
    }
    await initializer.rawDeleteBlocks(blocksToDelete);
    expect(accAfter.producedblocks).to.be.eq(201);
    expect(accAfter.missedblocks).to.be.eq(201);

    expect(accAfter.votesWeight).to.be.eq(Math.floor(accAfter.vote * 0.5));
  });
  it('should work even with 66.666% productivity', async function() {
    this.timeout(1000000);
    let blocksToDelete        = 0;
    const blocksToFinishRound = constants.activeDelegates - blocksModule.lastBlock.height;
    await initializer.rawMineBlocks(blocksToFinishRound);
    blocksToDelete += blocksToFinishRound;
    const acc                = await accountsModel.findById(newDelegateWallet.address);
    const initialVotesWeight = acc.votesWeight;
    expect(initialVotesWeight).to.be.equal(acc.balance);
    acc.set('producedblocks', 66666 - 1);
    acc.set('missedblocks', 100000 - 66666);
    await acc.save();
    let accAfter = acc;
    while (accAfter.producedblocks < 66666) {
      await initializer.rawMineBlocks(constants.activeDelegates);
      blocksToDelete += constants.activeDelegates;
      accAfter = await accountsModel.findById(newDelegateWallet.address);
    }
    await initializer.rawDeleteBlocks(blocksToDelete);
    expect(accAfter.producedblocks).to.be.eq(66666);
    expect(accAfter.missedblocks).to.be.eq(100000 - 66666);
    expect(accAfter.votesWeight).to.be.eq(Math.round(accAfter.vote * 0.66666));
  });

});
