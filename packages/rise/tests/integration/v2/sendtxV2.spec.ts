import { BlocksModule } from '@risevision/core-blocks';
import { ModelSymbols } from '@risevision/core-models';
import {
  SendTxAsset,
  SendTxAssetModel,
  TXSymbols,
} from '@risevision/core-transactions';
import { toNativeTx } from '@risevision/core-transactions/tests/unit/utils/txCrafter';
import { IAccountsModule, Symbols } from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {
  Address,
  IKeypair,
  RiseTransaction,
  RiseV2,
  RiseV2Transaction,
} from 'dpos-offline';
import * as supertest from 'supertest';
import initializer from '../common/init';
import {
  confirmTransactions,
  createRandomV2Wallet,
  createRandomWallet,
  createSendTransactionV1,
  createSendTransactionV2,
  getRandomDelegateWallet,
} from '../common/utils';

chai.use(chaiAsPromised);

// tslint:disable no-big-function no-unused-expression
describe('v2txtypes/send', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  let accModule: IAccountsModule;
  let delegateWallet: IKeypair;
  let blocksModule: BlocksModule;
  const v1 = [createRandomWallet(), createRandomWallet()];
  const v2 = [createRandomV2Wallet(), createRandomV2Wallet()];

  before(async () => {
    delegateWallet = getRandomDelegateWallet();
  });
  beforeEach(async () => {
    blocksModule = initializer.appManager.container.get(Symbols.modules.blocks);
    accModule = initializer.appManager.container.get(Symbols.modules.accounts);

    const txs = [
      createSendTransactionV2(
        10 * 1e8,
        getRandomDelegateWallet(),
        v1[0].address
      ),
      createSendTransactionV2(
        10 * 1e8,
        getRandomDelegateWallet(),
        v1[1].address
      ),
      createSendTransactionV2(
        10 * 1e8,
        getRandomDelegateWallet(),
        v2[0].address
      ),
      createSendTransactionV2(
        10 * 1e8,
        getRandomDelegateWallet(),
        v2[1].address
      ),
    ];

    const block = await initializer.rawMineBlockWithTxs(
      txs.map(toNativeTx),
      'direct'
    );
  });

  const matrix: {
    [k: string]: {
      from: IKeypair & { address: Address };
      to: IKeypair & { address: Address };
    };
  } = {
    'v1-v1': {
      from: v1[0],
      to: v1[1],
    },
    'v1-v2': {
      from: v1[0],
      to: v2[0],
    },
    'v2-v1': {
      from: v2[0],
      to: v1[0],
    },
    'v2-v2': {
      from: v2[0],
      to: v2[1],
    },
  };
  // tslint:disable-next-line
  for (const testName in matrix) {
    const testData = matrix[testName];
    describe(testName, () => {
      if (testName.startsWith('v1')) {
        describe('Send V1', () => {
          let tx: RiseTransaction<void>;
          beforeEach(async () => {
            tx = await createSendTransactionV1(
              0,
              500,
              testData.from,
              testData.to.address
            );
          });
          it('should include tx using pool', async () => {
            await confirmTransactions([tx], true);
            expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
          });
          it('should include not using pool', async () => {
            await confirmTransactions([tx], false);
            expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
          });
          it('should allow p2p broadcast of tx and include in block', async () => {
            await initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'p2p');
            expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
          });
          it('should move funds from a to b', async () => {
            await initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'direct');
            const fromAcct = await accModule.getAccount({
              address: testData.from.address,
            });
            const toAcct = await accModule.getAccount({
              address: testData.to.address,
            });
            expect(fromAcct.balance).deep.eq(
              BigInt(10 * 1e8) - 500n - BigInt(tx.fee)
            );
            expect(toAcct.balance).deep.eq(BigInt(10 * 1e8) + 500n);
          });
        });
      } else {
        describe('Send V1', () => {
          let tx: RiseTransaction<void>;
          // tslint:disable-next-line
          beforeEach(async () => {
            tx = await createSendTransactionV1(
              0,
              500,
              testData.from,
              testData.to.address
            );
          });
          it('should NOT include tx using pool', async () => {
            await confirmTransactions([tx], true);
            expect(blocksModule.lastBlock.transactions.length).deep.eq(0);
          });
          it('should NOT include not using pool', async () => {
            await expect(confirmTransactions([tx], false)).rejectedWith(
              /^Account [0-9]+R not found in db\.$/
            );
          });
          it('should NOT allow p2p broadcast of tx and include in block', async () => {
            await expect(
              initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'p2p')
            ).rejectedWith(/^Account [0-9]+R not found in db\.$/);
          });
          it('should NOT move funds from a to b', async () => {
            await expect(
              initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'direct')
            ).rejectedWith(/^Account [0-9]+R not found in db\.$/);
            const fromAcct = await accModule.getAccount({
              address: testData.from.address,
            });
            const toAcct = await accModule.getAccount({
              address: testData.to.address,
            });
            expect(fromAcct.balance).deep.eq(BigInt(10 * 1e8));
            expect(toAcct.balance).deep.eq(BigInt(10 * 1e8));
          });
        });
      }
      describe('Send V2', () => {
        let tx: RiseV2Transaction<SendTxAsset>;
        beforeEach(() => {
          tx = createSendTransactionV2(500, testData.from, testData.to.address);
        });

        it('should include tx using tx pool', async () => {
          await confirmTransactions([tx], true);
          expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
        });
        it('should include tx not using tx pool', async () => {
          await confirmTransactions([tx], false);
          expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
        });
        it('should allow p2p broadcasting of tx and include in block', async () => {
          await initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'p2p');
          expect(blocksModule.lastBlock.transactions[0].id).deep.eq(tx.id);
        });
        // tslint:disable-next-line
        it('should move funds from a to b', async () => {
          await initializer.rawMineBlockWithTxs([toNativeTx(tx)], 'direct');
          const fromAcct = await accModule.getAccount({
            address: testData.from.address,
          });
          const toAcct = await accModule.getAccount({
            address: testData.to.address,
          });
          expect(fromAcct.balance).deep.eq(
            BigInt(10 * 1e8) - 500n - BigInt(tx.fee)
          );
          expect(toAcct.balance).deep.eq(BigInt(10 * 1e8) + 500n);
        });
        describe('with asset', () => {
          let sendTxAssetModel: typeof SendTxAssetModel;
          beforeEach(() => {
            sendTxAssetModel = initializer.appManager.container.getNamed(
              ModelSymbols.model,
              TXSymbols.models.sendTxAsset
            );
          });
          it('should disallow tx with more than 128 bytes', async () => {
            const t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(129).fill(0xab),
              }
            );
            const height = blocksModule.lastBlock.height;
            await expect(confirmTransactions([t], false)).rejectedWith(
              'Cannot send more than 128'
            );
            expect(blocksModule.lastBlock.height).deep.eq(height);
          });
          it('should allow tx with 0 bytes and treat it as empty asset', async () => {
            const t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(0),
              }
            );
            await confirmTransactions([t], false);
            expect(blocksModule.lastBlock.transactions[0].id).eq(t.id);
            return supertest(initializer.apiExpress)
              .get(`/api/transactions/get?id=${t.id}`)
              .expect(200)
              .then((resp) => {
                expect(resp.body.transaction.id).to.be.eq(t.id);
                expect(resp.body.transaction.asset.data).deep.eq('');
              });
          });
          it('should save tx asset.', async () => {
            const t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(128).fill(0xab),
              }
            );
            await confirmTransactions([t], false);
            return supertest(initializer.apiExpress)
              .get(`/api/transactions/get?id=${t.id}`)
              .expect(200)
              .then((resp) => {
                expect(resp.body.transaction.id).to.be.eq(t.id);
                expect(resp.body.transaction.asset.data).deep.eq(
                  // tslint:disable-next-line max-line-length
                  'abababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababababab'
                );
              });
          });
          it('should disallow asset if fees are wrong', async () => {
            let t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(128).fill(0xab),
              }
            );
            // Rewrite the tx to have good signature but fee minus 1 sat.
            t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(128).fill(0xab),
                fee: `${parseInt(t.fee, 10) - 1}`,
              }
            );
            await expect(confirmTransactions([t], false)).rejectedWith(
              'Invalid transaction fee'
            );

            // With pool should not include tx in block
            await confirmTransactions([t], true);
            expect(blocksModule.lastBlock.transactions).deep.eq([]);
          });
          it('should disallow tx if asset is changd after signature', async () => {
            const t = createSendTransactionV2(
              500,
              testData.from,
              testData.to.address,
              {
                asset: Buffer.alloc(128).fill(0xab),
              }
            );
            t.asset.data = Buffer.alloc(128).fill(0xba);
            t.id = RiseV2.txs.identifier(t);
            await expect(confirmTransactions([t], false)).rejectedWith(
              'signature'
            );
          });
        });
      });
    });
  }

  it('should encode/decode asset field via api', async () => {
    const tx = createSendTransactionV2(
      10 * 1e8,
      getRandomDelegateWallet(),
      v1[0].address,
      {
        asset: Buffer.from('banana', 'utf8'),
      }
    );

    await confirmTransactions([tx], false);
    return supertest(initializer.apiExpress)
      .get(`/api/transactions/get?id=${tx.id}`)
      .expect(200)
      .then((d) => {
        expect(d.body.transaction.asset.data).deep.eq('62616e616e61' /* banana in utf8 */);
      });

  });
});
