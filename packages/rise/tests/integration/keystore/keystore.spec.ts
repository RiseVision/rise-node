// tslint:disable no-unused-expression
import {
  BlocksModule,
  BlocksModuleChain,
  BlocksSymbols,
} from '@risevision/core-blocks';
import { KeystoreModule, KeystoreTxSymbols } from '@risevision/core-keystore';
import { BaseTx, TXSymbols } from '@risevision/core-transactions';
import { SignedAndChainedBlockType, Symbols } from '@risevision/core-types';
import { IKeypair } from '@risevision/core-types';
import { Address } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromise from 'chai-as-promised';
import 'reflect-metadata';
import * as supertest from 'supertest';
import { createKeystoreTransaction } from '../../../../core-keystore/tests/utils/createTransaction';
import { toNativeTx } from '../../../../core-transactions/tests/unit/utils/txCrafter';
import initializer from '../common/init';
import {
  createRandomAccountWithFunds,
  createRandomWallet,
  enqueueAndProcessTransactions,
} from '../common/utils';

chai.use(chaiAsPromise);
// tslint:disable no-big-function
// describe('keystore', async function() {
//   this.timeout(100000);
//   let blocksModule: BlocksModule;
//   let blocksChainModule: BlocksModuleChain;
//   let wallet: IKeypair & { address: Address };
//
//   let module: KeystoreModule;
//   initializer.setup();
//   before(() => {
//     const toSet: {
//       [k: string]: BaseTx<any, any>;
//     } = initializer.appManager.container.get(Symbols.generic.txtypes);
//     toSet['100'] = initializer.appManager.container.getNamed(
//       TXSymbols.transaction,
//       KeystoreTxSymbols.transaction
//     );
//     toSet['100'].type = 100;
//   });
//   beforeEach(async () => {
//     blocksModule = initializer.appManager.container.get(
//       BlocksSymbols.modules.blocks
//     );
//     blocksChainModule = initializer.appManager.container.get(
//       BlocksSymbols.modules.chain
//     );
//     module = initializer.appManager.container.get(KeystoreTxSymbols.module);
//     wallet = createRandomWallet();
//     await createRandomAccountWithFunds(10000000, wallet);
//   });
//
//   it('should allow keystoreTransaction for an acct', async () => {
//     const t = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('b', 'utf8')
//     );
//     await initializer.rawMineBlockWithTxs([toNativeTx(t)], 'p2p');
//
//     expect(blocksModule.lastBlock.transactions[0].type).eq(100);
//     expect(blocksModule.lastBlock.transactions[0].id).eq(t.id);
//
//     const res = await module.getAcctKeyValue(wallet.address, 'a');
//     expect(res).deep.eq(new Buffer('b', 'utf8'));
//   });
//
//   it('should allow overriding keystoreTransaction for same key', async () => {
//     const t1 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('b', 'utf8')
//     );
//     await initializer.rawMineBlockWithTxs([toNativeTx(t1)], 'p2p');
//     const t2 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('c', 'utf8')
//     );
//     await initializer.rawMineBlockWithTxs([toNativeTx(t2)], 'p2p');
//
//     const res = await module.getAcctKeyValue(wallet.address, 'a');
//     expect(res).deep.eq(new Buffer('c', 'utf8'));
//
//     expect(await module.getAllAcctValues(wallet.address)).deep.eq({
//       current: {
//         a: new Buffer('c', 'utf8'),
//       },
//       history: {
//         a: [
//           {
//             height: blocksModule.lastBlock.height,
//             id: t2.id,
//             value: new Buffer('c', 'utf8'),
//           },
//           {
//             height: blocksModule.lastBlock.height - 1,
//             id: t1.id,
//             value: new Buffer('b', 'utf8'),
//           },
//         ],
//       },
//     });
//   });
//
//   it('should reject same acct 2 diff txs same key same block', async () => {
//     const t1 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('b', 'utf8')
//     );
//     const t2 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('c', 'utf8')
//     );
//
//     // both p2p and direct will fail
//     await expect(
//       initializer.rawMineBlockWithTxs([t1, t2].map(toNativeTx), 'p2p')
//     ).rejectedWith('Block is invalid');
//     await expect(
//       initializer.rawMineBlockWithTxs([t1, t2].map(toNativeTx), 'direct')
//     ).rejectedWith('Block is invalid');
//
//     // passing through pool should allow one tx to go through
//     await enqueueAndProcessTransactions([t1, t2]);
//     await initializer.rawMineBlocks(1);
//
//     expect(blocksModule.lastBlock.transactions.length).eq(1);
//     expect(blocksModule.lastBlock.transactions.map((a) => a.id)).deep.eq([
//       t1.id,
//     ]);
//
//     const r = await module.getAcctKeyValue(wallet.address, 'a');
//     expect(r).deep.eq(new Buffer('b', 'utf8'));
//   });
//
//   it('multiple values same acct', async () => {
//     const t1 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('b', 'utf8')
//     );
//     const t2 = await createKeystoreTransaction(
//       wallet,
//       'b',
//       new Buffer('c', 'utf8')
//     );
//
//     await initializer.rawMineBlockWithTxs([t1, t2].map(toNativeTx), 'p2p');
//
//     expect(blocksModule.lastBlock.transactions.length).eq(2);
//     expect(blocksModule.lastBlock.transactions.map((a) => a.id)).deep.eq([
//       t1.id,
//       t2.id,
//     ]);
//
//     const r = await module.getAllAcctValues(wallet.address);
//     expect(r.current).deep.eq({
//       a: new Buffer('b', 'utf8'),
//       b: new Buffer('c', 'utf8'),
//     });
//   });
//
//   it('not mix values for diff acct', async () => {
//     const wallet2 = createRandomWallet();
//     await createRandomAccountWithFunds(10000000, wallet2);
//     const t1 = await createKeystoreTransaction(
//       wallet,
//       'a',
//       new Buffer('b', 'utf8')
//     );
//     const t2 = await createKeystoreTransaction(
//       wallet,
//       'b',
//       new Buffer('c', 'utf8')
//     );
//     const t3 = await createKeystoreTransaction(
//       wallet2,
//       'b',
//       new Buffer('d', 'utf8')
//     );
//
//     await initializer.rawMineBlockWithTxs([t1, t2, t3].map(toNativeTx), 'p2p');
//
//     const r = await module.getAllAcctValues(wallet.address);
//     expect(r.current).deep.eq({
//       a: new Buffer('b', 'utf8'),
//       b: new Buffer('c', 'utf8'),
//     });
//
//     const rb = await module.getAllAcctValues(wallet2.address);
//     expect(rb.current).deep.eq({
//       b: new Buffer('d', 'utf8'),
//     });
//   });
//
//   describe('apis', () => {
//     beforeEach(async () => {
//       const t1 = await createKeystoreTransaction(
//         wallet,
//         'a',
//         new Buffer('bb', 'hex')
//       );
//       const t2 = await createKeystoreTransaction(
//         wallet,
//         'b',
//         new Buffer('cc', 'hex')
//       );
//       await initializer.rawMineBlockWithTxs([t1, t2].map(toNativeTx), 'direct');
//     });
//     describe('/history', () => {
//       it('should return empty object for inexisting acct', async () => {
//         return supertest(initializer.apiExpress)
//           .get(`/api/keystore/history?address=${'1R'}`)
//           .expect(200)
//           .then((response) => {
//             expect(response.body.success).is.true;
//             expect(response.body.history).deep.eq({});
//           });
//       });
//       it('should return proper history for acct', async () => {
//         return supertest(initializer.apiExpress)
//           .get(`/api/keystore/history?address=${wallet.address}`)
//           .expect(200)
//           .then((response) => {
//             expect(response.body.success).is.true;
//             expect(response.body.history).deep.eq({
//               a: [
//                 {
//                   height: blocksModule.lastBlock.height,
//                   id: blocksModule.lastBlock.transactions[0].id,
//                   value: 'bb',
//                 },
//               ],
//               b: [
//                 {
//                   height: blocksModule.lastBlock.height,
//                   id: blocksModule.lastBlock.transactions[1].id,
//                   value: 'cc',
//                 },
//               ],
//             });
//           });
//       });
//     });
//     describe('/current', () => {
//       it('should return undefined for non existing acct');
//       it('should return current val');
//     });
//   });
// });
