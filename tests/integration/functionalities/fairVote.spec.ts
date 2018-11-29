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
import { AccountsModel, BlocksModel } from '../../../src/models';
import * as uuid from 'uuid';
import { Op } from 'sequelize';
import { RoundsLogic } from '../../../src/logic';
import { IDelegatesModule } from '../../../src/ioc/interfaces/modules';

describe('Fair vote system', async () => {
  let blocksModule: BlocksModule;
  let blocksModel: typeof BlocksModel;
  let accountsModel: typeof AccountsModel;
  let delegatesModule: IDelegatesModule;
  let newDelegateWallet: LiskWallet;
  let newDelegateWalletNoVotes: LiskWallet;
  let roundsLogic: RoundsLogic;
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
    blocksModel     = initializer.appManager.container.get(Symbols.models.blocks);
    blocksModule    = initializer.appManager.container.get(Symbols.modules.blocks);
    roundsLogic     = initializer.appManager.container.get(Symbols.logic.rounds);
    accountsModel   = initializer.appManager.container.get<typeof AccountsModel>(Symbols.models.accounts);
    delegatesModule = initializer.appManager.container.get(Symbols.modules.delegates);
    // Each Delegate has a genesis balance of 108910891000000 and voted for himself. We transfer 1 third of balance
    // of a random genesis delegate to a new account that will vote for himself. This will give enough funds to increase
    // the forging chances, but not with normal dpos algorithm.
    const secret             = uuid.v4();
    newDelegateWallet        = createWallet(secret);
    const secret2            = uuid.v4();
    newDelegateWalletNoVotes = createWallet(secret2);
    await createRandomAccountWithFunds(Math.floor(108910891000000 / 3), newDelegateWallet);
    await createRandomAccountWithFunds(Math.floor(108910891000000 / 3), newDelegateWalletNoVotes);
    addNewDelegate({
      address : newDelegateWallet.address,
      keypair : {
        privateKey: newDelegateWallet.privKey,
        publicKey : newDelegateWallet.publicKey,
      },
      secret,
      username: 'outsider',
    });
    addNewDelegate({
      address : newDelegateWalletNoVotes.address,
      keypair : {
        privateKey: newDelegateWalletNoVotes.privKey,
        publicKey : newDelegateWalletNoVotes.publicKey,
      },
      secret  : secret2,
      username: 'outsider.no.votes',
    });
    const tx  = await createRegDelegateTransaction(0, newDelegateWallet, 'outsider');
    const tx2 = await createRegDelegateTransaction(0, newDelegateWalletNoVotes, 'outsider.no.votes');
    await initializer.rawMineBlockWithTxs([tx, tx2].map(toBufferedTransaction));
    await createVoteTransaction(1, newDelegateWallet, newDelegateWallet.publicKey, true);
  });
  afterEach(async function ()  {
    this.timeout(1000000);
    removeDelegatePass(newDelegateWallet.address);
    removeDelegatePass(newDelegateWalletNoVotes.address);
    await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
  });

  it('should at some point include outsider in round when dposv2 is active', async function () {
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
  it('should work even with 66.666% productivity', async function () {
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

  it('should NOT include outsider.no.votes in round when dposv2 is active', async function () {
    this.timeout(1000000);
    let minedBlocks = 0;
    let found       = false;
    const acc       = await accountsModel.findById(newDelegateWalletNoVotes.address);
    // Make sure the bew delegate hasn't forget yet
    expect(blocksModule.lastBlock.height).to.be.lt(constants.activeDelegates);
    expect(acc).not.to.be.undefined;
    expect(acc.producedblocks).to.be.equal(0);
    expect(acc.votesWeight).to.be.equal(0);

    // We assume it takes less than 20 rounds to include the outsider in forging.
    while (minedBlocks < 20 * constants.activeDelegates) {
      console.log('mined', minedBlocks);
      const howMany = minedBlocks === 0 ?
        constants.activeDelegates - blocksModule.lastBlock.height : constants.activeDelegates;
      await initializer.rawMineBlocks(howMany);
      minedBlocks += howMany;
      const accData = await accountsModel.findById(newDelegateWalletNoVotes.address);
      if (accData.producedblocks > 0) {
        found = true;
        break;
      }
    }
    await initializer.rawDeleteBlocks(minedBlocks);
    expect(found).to.be.false;
  });

  it('should not include delegate if he forged last block in round AND should set to last slot the delegate who forged the last block in a round less recently than others', async function () {
    this.timeout(10000000);
    await initializer.rawMineBlocks(101);
    const prevHeight = blocksModule.lastBlock.height;
    let preRoundNum=0;
    for (let rounds = 0; rounds < 100; rounds++) {
      console.log(`Round ${rounds}`);
      const curHeight = blocksModule.lastBlock.height;
      const toMine    = roundsLogic.lastInRound(roundsLogic.calcRound(curHeight))
        - curHeight;
      await initializer.rawMineBlocks(toMine);
      const lastForger = blocksModule.lastBlock.generatorPublicKey;
      const delegates  = await delegatesModule
        .generateDelegateList(blocksModule.lastBlock.height + 1);
      // should not include delegate if he forged last block in round
      expect(delegates.find((a) => a.equals(lastForger)))
        .undefined;

      preRoundNum = roundsLogic.calcRound(blocksModule.lastBlock.height);

      await initializer.rawMineBlocks(1);
    }

    expect(roundsLogic.calcRound(blocksModule.lastBlock.height) - preRoundNum).to.be.eq(1);

    await initializer.rawMineBlocks(100);
    expect(roundsLogic.calcRound(blocksModule.lastBlock.height) - preRoundNum).to.be.eq(1);
    expect(blocksModule.lastBlock.height % 101).to.be.equal(0);

    // Since we forged only 100 rounds every delegate should be eq 1
    const res = await blocksModel.sequelize.query(`
      SELECT COUNT(height) as ch, MAX(height) as mh, "generatorPublicKey" FROM blocks
         WHERE height % 101 = 0 
         group by "generatorPublicKey"
         order by "ch" asc
    `);
    expect(res[0].length).to.be.equal(102);
    for (let i = 0; i < res[0].length; i++) {
      expect(res[0][i].ch).eq(1);
    }
    let lowestMhItem = {... res[0][0]};
    res[0].forEach((item) => {
      if (item.mh < lowestMhItem.mh) {
        lowestMhItem = {... item};
      }
    });

    await initializer.rawMineBlocks(101);
    expect(roundsLogic.calcRound(blocksModule.lastBlock.height) - preRoundNum).to.be.eq(2);
    expect(blocksModule.lastBlock.height % 101).to.be.equal(0);
    expect(blocksModule.lastBlock.generatorPublicKey).to.be.deep.equal(lowestMhItem.generatorPublicKey);
    // TODO Also test producedBlocks is what we would expect?

  });
  it('should not include delegate if he missed too many blocks in a row', async function () {
    this.timeout(15000);
    let gene1 = await accountsModel.findOne({
      where: {
        username: 'genesisDelegate1',
      }
    });
    // Go to end of this round
    await initializer
      .rawMineBlocks(roundsLogic.lastInRound(roundsLogic.calcRound(blocksModule.lastBlock.height)) - blocksModule.lastBlock.height);

    gene1.cmb = 28 * 3;
    await gene1.save();
    await initializer.rawMineBlocks(101);

    let dels = await delegatesModule.generateDelegateList(blocksModule.lastBlock.height);
    // Delegate should be included in next round!
    expect(dels.map((d) => d.toString('hex')).findIndex((a) => a === gene1.hexPublicKey))
      .not.eq(-1);

    gene1     = await accountsModel.findOne({
      where: {
        username: 'genesisDelegate1'
      }
    });
    gene1.cmb = 28 * 3 + 1;
    await gene1.save();
    await initializer.rawMineBlocks(101);
    dels = await delegatesModule.generateDelegateList(blocksModule.lastBlock.height);
    // Delegate should NOT be included in next round!
    expect(dels.map((d) => d.toString('hex')).findIndex((a) => a === gene1.hexPublicKey))
      .eq(-1);
    // check not included

  });

  it('should reset delegates cmb if they forged blocks', async function () {
    this.timeout(15000);
    await accountsModel.update({
      cmb: 1,
    }, {
      where: {
        isDelegate: 1,
      },
    });

    let gene1 = await accountsModel.findOne({
      where: {
        username: 'genesisDelegate1',
      },
    });
    expect(gene1.cmb).eq(1);
    await initializer.rawMineBlocks(101);
    gene1 = await accountsModel.findOne({
      where: {
        username: 'genesisDelegate1',
      },
    });

    const missedBlockDelegates = await accountsModel.findAll({
      attributes: ['username'],
      raw: true,
      where: {
        cmb: { [Op.gt]: 0 },
        username: { [Op.notIn] : ['outsider', 'outsider.no.votes'] }
      },
    });

    expect(missedBlockDelegates).to.be.empty;
    expect(gene1.cmb).eq(0);
  });
});
