import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as supertest from 'supertest';
import { IPeersLogic, ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import { IBlocksModule, IPeersModule, ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';

import initializer from '../common/init';
import { createRandomAccountWithFunds, createRandomWallet, createSendTransaction } from '../common/utils';
import { checkReturnObjKeyVal } from './utils';
import { createFakePeers } from '../../utils/fakePeersFactory';
import { PeerType } from '../../../src/logic';

// tslint:disable no-unused-expression max-line-length
const headers = {
  nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
  version: '0.1.10',
  port   : 1
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

describe('api/transport', () => {

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

  describe('/signatures', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/signatures'));
    checkReturnObjKeyVal('signatures', [], '/peer/signatures', headers);
    it('should return multisig signatures missing some sigs');
  });

  describe('/transactions', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/transactions'));
    it('should return all transactions in queue');
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
    it('should query last 34 blocks from given lastId');
  });

  describe('/blocks [post]', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/peer/blocks/'));
    it('should throw if block is not valid');
    it('should remove just inserted peer if block is not valid');
    it('should process and add block to blockchain if valid');
    it('should delete last 2 blocks if fork 1');
    it('should delete last block if fork 5');
  });

});
