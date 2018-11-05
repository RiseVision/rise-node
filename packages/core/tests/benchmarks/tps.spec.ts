import { dposOffline, LiskWallet } from 'dpos-offline';
import { Sequelize } from 'sequelize-typescript';
import constants from '../../src/helpers/constants';
import { IBlocksModule, ISystemModule } from '../../src/ioc/interfaces/modules';
import { Symbols } from '../../src/ioc/symbols';
import initializer from '../integration/common/init';
import {
  confirmTransactions,
  createRandomWallet,
  findDelegateByUsername,
} from '../integration/common/utils';
import { reportedIT } from './benchutils';

const numTransactions = 90000;
describe('TPS', function() {
  this.timeout(1000000);
  initializer.setup();
  initializer.autoRestoreEach();
  const accounts: LiskWallet[] = [];
  const delegateAccounts: LiskWallet[] = [];
  let consts: typeof constants;
  let sequelize: Sequelize;
  let systemModule: ISystemModule;
  before(() => {
    for (let i = 0; i < 100000; i++) {
      accounts.push(createRandomWallet());
    }
    for (let i = 0; i < 101; i++) {
      delegateAccounts.push(
        new LiskWallet(
          findDelegateByUsername(`genesisDelegate${i + 1}`).secret,
          'R'
        )
      );
    }
  });
  beforeEach(async () => {
    consts = initializer.appManager.container.get<typeof constants>(
      Symbols.helpers.constants
    );
    sequelize = initializer.appManager.container.get<Sequelize>(
      Symbols.generic.sequelize
    );
    systemModule = initializer.appManager.container.get(Symbols.modules.system);
    await initializer.rawMineBlocks(1); // Avoid round apply on first block.
  });

  // reportedIT('with always different accounts', [250, 25, 2500], async function (blockSize: number) {
  //
  //   const txs             = [];
  //   const oldTxsPerBlock  = consts.maxTxsPerBlock;
  //   consts.maxTxsPerBlock = blockSize;
  //   const sendFee         = systemModule.getFees().fees.send;
  //   const blocks          = Math.ceil(numTransactions / consts.maxTxsPerBlock);
  //
  //   for (let i = 0; i < blockSize; i++) {
  //     const del = findDelegateByUsername(`genesisDelegate1`);
  //     const t   = new dposOffline.transactions.SendTx()
  //       .set('amount', sendFee + sendFee * blocks * 2)
  //       .set('fee', sendFee)
  //       .set('timestamp', i)
  //       .set('recipientId', accounts[i].address)
  //       .sign(new LiskWallet(del.secret, 'R'));
  //
  //     t['senderId'] = del.address;
  //     txs.push(t);
  //   }
  //   await confirmTransactions(txs, false);
  //   txs.splice(0, txs.length); // delete init transaction
  //
  //   for (let b = 0; b < blocks; b++) {
  //     const offset              = b * consts.maxTxsPerBlock;
  //     const nextOffset          = (b + 1) * consts.maxTxsPerBlock;
  //     const amountToSendThisRun = sendFee * (blocks - b);
  //     for (let i = 0; i < consts.maxTxsPerBlock && offset + i < numTransactions; i++) {
  //       const sender = accounts[(offset + i)];
  //       const t      = new dposOffline.transactions.SendTx();
  //       t.set('amount', amountToSendThisRun);
  //       t.set('fee', systemModule.getFees().fees.send);
  //       t.set('timestamp', b * blockSize + i);
  //       t.set('recipientId', accounts[nextOffset + i].address);
  //       const signedTx       = t.sign(sender);
  //       signedTx['senderId'] = sender.address;
  //       txs.push(signedTx);
  //     }
  //   }
  //
  //   const now = Date.now();
  //   await confirmTransactions(txs, false);
  //   const took            = Date.now() - now;
  //   consts.maxTxsPerBlock = oldTxsPerBlock;
  //   return txs.length / took * 1000;
  // });
  //
  // reportedIT('with always same sender accounts', [250, 25, 2500], async (blockSize) => {
  //   const txs             = [];
  //   const oldTxsPerBlock  = consts.maxTxsPerBlock;
  //   consts.maxTxsPerBlock = blockSize;
  //   const sendFee         = systemModule.getFees().fees.send;
  //   const blocks          = Math.ceil(numTransactions / consts.maxTxsPerBlock);
  //
  //   for (let b = 0; b < blocks; b++) {
  //     const offset              = b * consts.maxTxsPerBlock;
  //     const nextOffset          = (b + 1) * consts.maxTxsPerBlock;
  //     const amountToSendThisRun = sendFee * (blocks - b);
  //     for (let i = 0; i < consts.maxTxsPerBlock && offset + i < numTransactions; i++) {
  //       const sender = delegateAccounts[i % 101];
  //       const t      = new dposOffline.transactions.SendTx();
  //       t.set('amount', amountToSendThisRun);
  //       t.set('fee', systemModule.getFees().fees.send);
  //       t.set('timestamp', b * blockSize + i);
  //       t.set('recipientId', accounts[nextOffset + i].address);
  //       const signedTx       = t.sign(sender);
  //       signedTx['senderId'] = sender.address;
  //       txs.push(signedTx);
  //     }
  //   }
  //
  //   const now = Date.now();
  //   await confirmTransactions(txs, false);
  //   const took            = Date.now() - now;
  //   consts.maxTxsPerBlock = oldTxsPerBlock;
  //   return txs.length / took * 1000;
  // });

  reportedIT(
    'with always same (non-voting) sender accounts',
    [
      ,
      // 25, 50, 100, 200,
      // 300,
      // , 400, 500,
      // 1000,
      2000,
      3000,
      4000,
      5000,
    ],
    async (blockSize) => {
      const txs = [];
      const oldTxsPerBlock = consts.maxTxsPerBlock;
      consts.maxTxsPerBlock = blockSize;
      const sendFee = systemModule.getFees().fees.send;
      const blocks = Math.min(
        90,
        Math.ceil(numTransactions / consts.maxTxsPerBlock)
      );

      for (let i = 0; i < blockSize; i++) {
        const del = findDelegateByUsername('genesisDelegate1');
        const t = new dposOffline.transactions.SendTx()
          .set('amount', sendFee + sendFee * blocks * 2)
          .set('fee', sendFee)
          .set('timestamp', i)
          .set('recipientId', accounts[i].address)
          .sign(new LiskWallet(del.secret, 'R'));

        t.senderId = del.address;
        txs.push(t);
      }
      await confirmTransactions(txs, false);
      txs.splice(0, txs.length); // delete init transaction

      for (let b = 0; b < blocks; b++) {
        const offset = b * consts.maxTxsPerBlock;
        for (
          let i = 0;
          i < consts.maxTxsPerBlock && offset + i < numTransactions;
          i++
        ) {
          const sender = accounts[i % blockSize];
          const t = new dposOffline.transactions.SendTx();
          t.set('amount', 1);
          t.set('fee', systemModule.getFees().fees.send);
          t.set('timestamp', b * blockSize + i);
          t.set('recipientId', sender.address);
          const signedTx = t.sign(sender);
          signedTx.senderId = sender.address;
          txs.push(signedTx);
        }
      }

      const now = Date.now();
      await confirmTransactions(txs, false);
      const took = Date.now() - now;
      consts.maxTxsPerBlock = oldTxsPerBlock;
      return (txs.length / took) * 1000;
    }
  );

  //
  // reportedIT('with always same sender and recipient accounts', [250, 25], async (blockSize) => {
  //   const txs             = [];
  //   const oldTxsPerBlock  = consts.maxTxsPerBlock;
  //   consts.maxTxsPerBlock = blockSize;
  //   const sendFee         = systemModule.getFees().fees.send;
  //   const blocks          = Math.ceil(numTransactions / consts.maxTxsPerBlock);
  //
  //   for (let b = 0; b < blocks; b++) {
  //     const offset              = b * consts.maxTxsPerBlock;
  //     const nextOffset          = (b + 1) * consts.maxTxsPerBlock;
  //     const amountToSendThisRun = sendFee * (blocks - b);
  //     for (let i = 0; i < consts.maxTxsPerBlock && offset + i < numTransactions; i++) {
  //       const sender = delegateAccounts[i % 101];
  //       const t      = new dposOffline.transactions.SendTx();
  //       t.set('amount', amountToSendThisRun);
  //       t.set('fee', systemModule.getFees().fees.send);
  //       t.set('timestamp', b * blockSize + i);
  //       t.set('recipientId', delegateAccounts[(i + 1) % 101].address);
  //       const signedTx       = t.sign(sender);
  //       signedTx['senderId'] = sender.address;
  //       txs.push(signedTx);
  //     }
  //   }
  //
  //   const now = Date.now();
  //   await confirmTransactions(txs, false);
  //   const took            = Date.now() - now;
  //   consts.maxTxsPerBlock = oldTxsPerBlock;
  //   return txs.length / took * 1000;
  // });
});
