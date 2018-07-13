import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as supertest from 'supertest';
import * as z_schema from 'z-schema';
import { IBlockLogic, IPeersLogic, ITransactionLogic, ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import {
  IBlocksModule,
  IBlocksModuleVerify,
  IForkModule,
  IPeersModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';

import initializer from '../common/init';
import {
  createMultiSignAccount,
  createRandomAccountWithFunds,
  createRandomWallet,
  createSendTransaction,
  getRandomDelegateWallet
} from '../common/utils';
import { checkReturnObjKeyVal } from './utils';
import { createFakePeers } from '../../utils/fakePeersFactory';
import { PeerType, SignedBlockType } from '../../../src/logic';
import { BlocksModel, TransactionsModel } from '../../../src/models';
import { ISlots } from '../../../src/ioc/interfaces/helpers';
import * as sinon from 'sinon';
import { Ed, ForkType } from '../../../src/helpers';
import constants from '../../../src/helpers/constants';
import { createRandomTransactions, toBufferedTransaction } from '../../utils/txCrafter';

// tslint:disable no-unused-expression max-line-length
const headers = {
  nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
  version: '0.1.10',
  port   : 1
};

const transportTXSchema = {
  id        : 'Transaction',
  type      : 'object',
  properties: {
    id                : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    height            : {
      type: 'integer',
    },
    blockId           : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    type              : {
      type: 'integer',
    },
    timestamp         : {
      type: 'integer',
      minimum: 0,
    },
    senderPublicKey   : {
      type: 'string',
      format  : 'publicKey',
    },
    requesterPublicKey: {
      type: 'string',
      format  : 'publicKey',
    },
    senderId          : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    recipientId       : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    amount            : {
      type   : 'integer',
      minimum: 0
    },
    fee               : {
      type   : 'integer',
      minimum: 0
    },
    signature         : {
      type: 'string',
      format  : 'signature',
    },
    signSignature     : {
      type  : 'string',
      format: 'signature',
    },
    asset             : {
      type: 'object',
    },
  },
  required  : ['type', 'timestamp', 'senderId', 'senderPublicKey', 'signature', 'fee', 'amount'],
};


function checkHeadersValidation(p: () => supertest.Test) {
  it('should fail if version is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.version;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: version');
      });
  });
  it('should fail if nethash is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.nethash;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: nethash');
      });
  });
  it('should fail if port is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.port;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: port');
      });
  });

  it('should fail if nethash is not correct', () => {
    const tmp   = { ...{}, ...headers };
    tmp.nethash = new Array(64).fill(null).map(() => 'a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error.message).to.contain('Request is made on the wrong network');
      });
  });
  it('should fail if broadhash is not hex', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.broadhash  = 'hh'
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('broadhash - Object didn\'t pass validation for format');
      });
  });
  it('should fail if height is string', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.height     = 'hh';
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('height - Expected type integer');
      });
  });
  it('should fail if nonce is less than 16 chars', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.nonce      = new Array(15).fill(null).fill('a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('nonce - String is too short (15 chars)');
      });
  });
  it('should fail if nonce is longer than 36 chars', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.nonce      = new Array(37).fill(null).fill('a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('nonce - String is too long (37 chars)');
      });
  });

}

describe('peer/transport', () => {

  initializer.setup();

  describe('/ping', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/ping'));
    checkReturnObjKeyVal('success', true, '/peer/ping', headers);
  });
  describe('/height', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/height'));

    describe('with some blocks', () => {
      initializer.createBlocks(10, 'each');
      checkReturnObjKeyVal('height', 11, '/peer/height', headers);
    });
  });

  describe('/list', () => {
    let peers: PeerType[];
    let peersLogic: IPeersLogic;
    before(() => {
      peers      = createFakePeers(10);
      peersLogic = initializer.appManager.container.get<IPeersLogic>(Symbols.logic.peers);
      peers.forEach((p) => peersLogic.upsert(p, true));

    });
    after(() => {
      peers.map((p) => peersLogic.remove(p));
    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/list'));
    it('should return known peers ', () => {
      return supertest(initializer.appManager.expressApp)
        .get('/peer/list')
        .set(headers)
        .expect(200)
        .then((res) => {
          expect(res.body.peers).to.be.an('array');
          // Check peers existence.!
          for (let i = 0; i < peers.length; i++) {
            expect(res.body.peers.find((p) => p.ip === peers[i].ip).ip).to.be.eq(peers[i].ip);
            expect(Date.now() - res.body.peers[i].updated).to.be.lt(100);
          }
        });
    });
    it('should return other peers if inserted', () => {
      const peersModule: IPeersModule = initializer.appManager.container.get(Symbols.modules.peers);

      const peer = peersLogic.create({
        ip  : '1.1.1.1',
        port: 120,
      });
      peer.applyHeaders({
        broadhash: 'broadhash',
        height   : 10,
        nethash  : 'nethash',
        nonce    : 'nonce',
        os       : 'os',
        version  : '1.0.0',
      } as any);
      peersModule.update(peer);

      return supertest(initializer.appManager.expressApp)
        .get('/peer/list')
        .set(headers)
        .expect(200)
        .then((res) => {
          const [thePeer] = res.body.peers.filter((p) => p.ip === '1.1.1.1');
          expect(thePeer).to.be.deep.eq(peer.object());
        });

    });
  });

  describe('/signatures [GET & POST]', () => {
    let blocksModule: IBlocksModule;
    let txModule: ITransactionsModule;
    let txLogic: ITransactionLogic;
    let ed: Ed;
    let txPool: ITransactionPoolLogic;
    let multisigKeys: LiskWallet[];
    let multisigAccount: LiskWallet;
    beforeEach(async () => {
      blocksModule     = initializer.appManager.container.get(Symbols.modules.blocks);
      txModule         = initializer.appManager.container.get(Symbols.modules.transactions);
      ed               = initializer.appManager.container.get(Symbols.helpers.ed);
      txLogic          = initializer.appManager.container.get(Symbols.logic.transaction);
      txPool           = initializer.appManager.container.get(Symbols.logic.transactionPool);
      const { wallet } = await createRandomAccountWithFunds(5000000000);
      const { keys }  = await createMultiSignAccount(
        wallet,
        [createRandomWallet(), createRandomWallet(), createRandomWallet()],
        3
        );

      multisigAccount = wallet;
      multisigKeys = keys;
      txPool.multisignature.list(false).forEach((w) => txPool.multisignature.remove(w.id));

    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/signatures'));
    checkReturnObjKeyVal('signatures', [], '/peer/signatures', headers);
    it('POST: should allow signature', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({transaction: tx})
        .expect(200, {success: true});
      await txPool.processBundled();
      await txModule.fillPool();
      await supertest(initializer.appManager.expressApp)
        .post('/peer/signatures')
        .set(headers)
        .send({
          signature: {
            signature: multisigKeys[0].getSignatureOfTransaction(tx),
            transaction: tx.id,
          },
        })
        .expect(200, {success: true});

      await supertest(initializer.appManager.expressApp)
        .post('/peer/signatures')
        .set(headers)
        .send({
          signature: {
            antani: multisigKeys[1].getSignatureOfTransaction(tx),
            transaction: tx.id,
          },
        })
        .expect(200, {success: false, error: '#/ - Missing required property: signature'});
    });
    it('POST: should allow signatures', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({transaction: tx})
        .expect(200, {success: true});
      await txPool.processBundled();
      await txModule.fillPool();
      await supertest(initializer.appManager.expressApp)
        .post('/peer/signatures')
        .set(headers)
        .send({
          signatures: [{
            signature: multisigKeys[0].getSignatureOfTransaction(tx),
            transaction: tx.id,
          }],
        })
        .expect(200, {success: true});

      await supertest(initializer.appManager.expressApp)
        .post('/peer/signatures')
        .set(headers)
        .send({
          signatures: [{
            antani: multisigKeys[1].getSignatureOfTransaction(tx),
            transaction: tx.id,
          }, 'antani'],
        })
        .expect(200, {success: true}); // Even if it is not valid.


    });
    it('should return multisig signatures missing some sigs', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({transaction: tx})
        .expect(200, {success: true});
      await txPool.processBundled();
      await txModule.fillPool();
      await initializer.rawMineBlocks(1);
      expect(blocksModule.lastBlock.numberOfTransactions).eq(0);

      // add 2 out of 3 signatures.
      const sigs = [];
      for (let i = 0; i < multisigKeys.length; i++) {
        const signature = ed.sign(
          txLogic.getHash(toBufferedTransaction(tx), false, false),
          {
            privateKey: Buffer.from(multisigKeys[i].privKey, 'hex'),
            publicKey : Buffer.from(multisigKeys[i].publicKey, 'hex'),
          }
        );
        await supertest(initializer.appManager.expressApp)
          .post('/peer/signatures')
          .set(headers)
          .send({
            // signatures: [{
            //   signature  : signature.toString('hex'),
            //   transaction: tx.id,
            // }],
            signature: {
              signature: signature.toString('hex'),
              transaction: tx.id
            }
          })
          .expect(200, {success: true});

        sigs.push(signature.toString('hex'));
        const {body} = await supertest(initializer.appManager.expressApp)
          .get('/peer/signatures')
          .set(headers)
          .expect(200, {
            success   : true,
            signatures: [{
              signatures : sigs,
              transaction: tx.id
            }],
          });
      }
      // all signatures.
      await supertest(initializer.appManager.expressApp)
        .get('/peer/signatures')
        .set(headers)
        .expect(200, {
          success: true,
          signatures: [
            {signatures: sigs, transaction: tx.id}
          ],
        });

      await initializer.rawMineBlocks(1);

      // After block is mined no more sigs are here.
      await supertest(initializer.appManager.expressApp)
        .get('/peer/signatures')
        .set(headers)
        .expect(200, {success: true, signatures: []});

      expect(blocksModule.lastBlock.transactions.length).eq(1);
    });
  });

  describe('/transactions', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/transactions'));
    it('should return all transactions in queue', async function () {
      this.timeout(10000);
      const txModule         = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
      const txPool           = initializer.appManager.container.get<ITransactionPoolLogic>(Symbols.logic.transactionPool);
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 8));
      const account          = wallet;
      const tx1  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const tx2  = await createSendTransaction(0, 2, account, createRandomWallet().address);
      await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({ transactions: [tx1, tx2] })
        .expect(200);
      await txPool.processBundled();
      // await txModule.fillPool();

      const {body} = await supertest(initializer.appManager.expressApp)
        .get('/peer/transactions')
        .set(headers)
        .expect(200);
      expect(body.transactions.length).eq(2);

      const zschema = initializer.appManager.container.get<z_schema>(Symbols.generic.zschema);
      for(const t of body.transactions) {
        const res = zschema.validate(t, transportTXSchema);
        expect(res).is.eq(true);
      }
    });
  });

  describe('/transactions [POST]', function () {
    this.timeout(10000);
    let account: LiskWallet;
    let blocksModule: IBlocksModule;
    let txModule: ITransactionsModule;
    let txPool: ITransactionPoolLogic;
    beforeEach(async () => {
      blocksModule     = initializer.appManager.container.get(Symbols.modules.blocks);
      txModule         = initializer.appManager.container.get(Symbols.modules.transactions);
      txPool           = initializer.appManager.container.get(Symbols.logic.transactionPool);
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 8));
      account          = wallet;
    });
    afterEach(async () => {
      await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/peer/transactions'));
    it('should enqueue transaction', async () => {
      const tx  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const res = await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({ transaction: tx })
        .expect(200);
      // console.log(await txModule.getByID(tx.id));
      expect(txPool.transactionInPool(tx.id)).is.true;
    });
    it('should enqueue bundled transactions', async () => {
      const tx  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const res = await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({ transactions: [tx, tx] })
        .expect(200);
      // console.log(await txModule.getByID(tx.id));
      expect(txPool.transactionInPool(tx.id)).is.true;
    });
    it('should validate transactions');
    it('should validate transaction');
  });

  describe('/blocks/common', () => {
    initializer.createBlocks(10, 'single');
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/blocks/common'));
    it('should throw if given ids is not csv', async () => {
      const res = await supertest(initializer.appManager.expressApp)
        .get('/peer/blocks/common?ids=ohh%20yeah')
        .set(headers)
        .expect(200);
      expect(res.body.success).is.false;
      expect(res.body.error).is.eq('Invalid block id sequence');
    });
    it('should throw if more than 10 ids are given', async () => {
      const res = await supertest(initializer.appManager.expressApp)
        .get('/peer/blocks/common?ids=1,2,3,4,5,6,7,8,9,0,1')
        .set(headers)
        .expect(200);
      expect(res.body.success).is.false;
      expect(res.body.error).is.eq('Invalid block id sequence');
    });
    it('should throw and remove querying peer if one or many ids are not numeric');
    it('should return the most heigh commonblock if any', async () => {
      const lastBlock = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks).lastBlock;
      const genesis   = initializer.appManager.container.get<any>(Symbols.generic.genesisBlock);
      const res       = await supertest(initializer.appManager.expressApp)
        .get(`/peer/blocks/common?ids=${genesis.id},2,33433441728981446756,${lastBlock.previousBlock}`)
        .set(headers)
        .expect(200);
      expect(res.body.success).is.true;
      expect(res.body.common).is.not.null;
      expect(res.body.common.height).is.eq(lastBlock.height - 1);
    });
    it('should return null if no common blocks', async () => {
      const res = await supertest(initializer.appManager.expressApp)
        .get('/peer/blocks/common?ids=1,2,3,')
        .set(headers)
        .expect(200);
      expect(res.body.success).is.true;
      expect(res.body.common).is.null;
    });
  });

  describe('/blocks', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/blocks/'));
    it('should throw if lastBlockId is not a valid number');
    it('should query last 34 blocks from given lastId', async () => {
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 10));
      const txs = (await Promise.all(new Array(25).fill(null)
        .map((_, idx) => createSendTransaction(0, idx+1, wallet, '1R'))))
        .map((tx) => toBufferedTransaction(tx));
      const b = await initializer.rawMineBlockWithTxs([]);

      const r = await supertest(initializer.appManager.expressApp)
        .get('/peer/blocks?lastBlockId='+b.previousBlock)
        .set(headers)
        .expect(200);
      console.log(JSON.stringify(r.body).length);
      console.log(r.body.blocks.length);
    });
  });

  describe('/blocks [post]', () => {
    let blockLogic: IBlockLogic;
    let blocksModule: IBlocksModule;
    let block: SignedBlockType<string>;
    let blockBuf: SignedBlockType<Buffer>;
    let senderAccount: LiskWallet;
    let blocksModel: typeof BlocksModel;
    let transactionsModel: typeof TransactionsModel;
    beforeEach(async () => {
      senderAccount     = getRandomDelegateWallet();
      blockLogic        = initializer.appManager.container.get<IBlockLogic>(Symbols.logic.block);
      blocksModule      = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
      blocksModel       = initializer.appManager.container.get<typeof BlocksModel>(Symbols.models.blocks);
      transactionsModel = initializer.appManager.container.get<typeof TransactionsModel>(Symbols.models.transactions);
      blockBuf          = await initializer.generateBlock([(await createSendTransaction(0, 1, senderAccount, senderAccount.address))]);
      blockBuf.id       = blockLogic.getId(blockBuf);
      block             = blocksModel.toStringBlockType(blockBuf, transactionsModel, blocksModule);
    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/peer/blocks/'));
    it('should accept valid block and save it in blockchain', async () => {
      const response = await supertest(initializer.appManager.expressApp)
        .post('/peer/blocks')
        .set(headers)
        .send({ block })
        .expect(200);
      expect(response.body.success).is.true;
      expect(response.body.blockId).is.eq(block.id);

      expect(blocksModule.lastBlock.id).is.eq(block.id);
    });
    it('should discard block if height is off', async () => {
      blockBuf.height = 10330;
      blockBuf.id     = blockLogic.getId(blockBuf);
      block           = blocksModel.toStringBlockType(blockBuf, transactionsModel, blocksModule);
      return supertest(initializer.appManager.expressApp)
        .post('/peer/blocks')
        .set(headers)
        .send({ block })
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.eq('Block discarded - not in current chain');
        });
    });
    describe('payload issues', async () => {
      it('should reject block if payload is mismatching', async () => {
        block.payloadHash = Buffer.alloc(32).fill('aa').toString('hex');
        return supertest(initializer.appManager.expressApp)
          .post('/peer/blocks')
          .set(headers)
          .send({ block })
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.false;
          });
      });
      it('should reject block if tx in payload is wrong', async () => {
        block.transactions[0].fee = 1;
        return supertest(initializer.appManager.expressApp)
          .post('/peer/blocks')
          .set(headers)
          .send({ block })
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.false;
          });
      });
      it('should reject block if payloadHash is not ok', async () => {
        block.transactions[0] = await createSendTransaction(0, 1, senderAccount, senderAccount.address, { timestamp: 10 }) as any;
        return supertest(initializer.appManager.expressApp)
          .post('/peer/blocks')
          .set(headers)
          .send({ block })
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.false;
            expect(response.body.error).is.eq('Invalid payload hash');
          });
      });
    });

    it('should remove just inserted peer if block is not valid');
    it('should process and add block to blockchain if valid');
    it('should delete last block if fork 5', async () => {
      await initializer.rawMineBlocks(1);
      const nextBlock = await initializer.generateBlock();
      blockBuf.id     = nextBlock.id = blockLogic.getId(nextBlock);
      // Generate a block with an id less than nextBlock
      for (let i = 0; blockBuf.id >= nextBlock.id; i++) {
        blockBuf    = await initializer.generateBlock([
          (await createSendTransaction(0, 1, senderAccount, senderAccount.address, { timestamp: i + 1 })),
        ]);
        blockBuf.id = blockLogic.getId(blockBuf);
      }
      block = blocksModel.toStringBlockType(blockBuf, transactionsModel, blocksModule);
      await initializer.rawMineBlocks(1);
      expect(blocksModule.lastBlock.id).to.be.eq(nextBlock.id);
      // fake slots otherwise we won't be able to

      const verifyModule = initializer.appManager.container.get<IBlocksModuleVerify>(Symbols.modules.blocksSubModules.verify);
      const forksModule  = initializer.appManager.container.get<IForkModule>(Symbols.modules.fork);
      const stub         = sinon.stub(verifyModule as any, 'verifyBlockSlotWindow').returns([]);
      const spyFork      = sinon.spy(forksModule, 'fork');

      const response = await  supertest(initializer.appManager.expressApp)
        .post('/peer/blocks')
        .set(headers)
        .send({ block })
        .expect(200);

      expect(response.body.success).is.true;
      expect(blocksModule.lastBlock.id).to.be.eq(block.id);
      stub.restore();

      expect(spyFork.calledOnce).is.true;
      expect(spyFork.firstCall.args[1]).is.deep.eq(ForkType.TYPE_5);
      spyFork.restore();
    });

    // it('should delete last 2 blocks if fork 1', async () => {
    //   // Fork 1 happens when node has
    //   // A -> B(height = A.height+1, previousBlock = A)
    //   // but receives
    //   // C(height = B.height+ 1 , previousBlock != B)
    //
    //   const slots  = initializer.appManager.container.get<ISlots>(Symbols.helpers.slots);
    //   const consts = initializer.appManager.container.get<typeof constants>(Symbols.helpers.constants);
    //   const orig   = slots.getTime;
    //   sinon.stub(slots, 'getTime').callsFake((time: number) => {
    //     if (time) {
    //       return orig.call(slots, time);
    //     }
    //     return slots.getSlotTime(slots.getSlotNumber(blocksModule.lastBlock.timestamp) + 1);
    //   });
    //
    //   await initializer.rawMineBlocks(2);
    //   console.log('afterMining', blocksModule.lastBlock.height);
    //   const blockB = blocksModule.lastBlock;
    //   const blockC = await initializer.generateBlock();
    //   blockC.id = blockLogic.getId(blockBuf);
    //   await initializer.rawDeleteBlocks(1); // remove B
    //   console.log('remining b', blocksModule.lastBlock.height);
    //   // mine a different B
    //   await initializer.rawMineBlockWithTxs([toBufferedTransaction(
    //     await createSendTransaction(0, 1, senderAccount, senderAccount.address, {timestamp: 1}))
    //   ]);
    //   // expect(blocksModule.lastBlock.id).to.not.be.eq(blockB);
    //
    //   // now send C
    //   await supertest(initializer.appManager.expressApp)
    //     .post('/peer/blocks')
    //     .set(headers)
    //     .send({ block: blocksModel.toStringBlockType(blockC, transactionsModel, blocksModule) })
    //     .expect(200);
    //
    //   expect(blocksModule.lastBlock.height).to.be.eq(1);
    //
    //
    // });
  });

});
