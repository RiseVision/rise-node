import { expect } from 'chai';
import initializer from './common/init';
import { BlocksModule, BlocksSymbols } from '@risevision/core-blocks';
import { createRandomAccountWithFunds, createRandomWallet } from './common/utils';
import { wait } from '@risevision/core-utils';
process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
  console.log('unhandledRejection', error);
});
describe('lerna-integration', function () {
  this.timeout(1000000);
  initializer.setup();
  it('meow', async () => {
    const {txID} = await createRandomAccountWithFunds(1000, createRandomWallet());
    const bm = initializer.appManager.container.get<BlocksModule>(BlocksSymbols.modules.blocks);
    expect(bm.lastBlock.transactions.map((t) => t.id).indexOf(txID)).eq(0);
    await initializer.rawMineBlocks(1);

    expect(bm.lastBlock.transactions).empty;
  });
});
