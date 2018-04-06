import { expect } from 'chai';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as supertest from 'supertest';
import { IPeersLogic, ITransactionPoolLogic } from '../../../src/ioc/interfaces/logic';
import { IBlocksModule, IPeersModule, ITransactionsModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';

import initializer from '../common/init';
import { createRandomAccountWithFunds, createRandomWallet, createSendTransaction } from '../common/utils';
import { checkReturnObjKeyVal } from './utils';

// tslint:disable no-unused-expression max-line-length
const headers = {
  nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
  version: '0.1.10',
  port   : 1
};

function checkHeadersValidation(p: () => supertest.Test) {
  it('should fail if version is not provided', () => {
    const tmp = {...{}, ...headers};
    delete tmp.version;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: version');
      });
  });
  it('should fail if nethash is not provided', () => {
    const tmp = {...{}, ...headers};
    delete tmp.nethash;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: nethash');
      });
  });
  it('should fail if port is not provided', () => {
    const tmp = {...{}, ...headers};
    delete tmp.port;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('Missing required property: port');
      });
  });

  it('should fail if nethash is not correct', () => {
    const tmp   = {...{}, ...headers};
    tmp.nethash = new Array(64).fill(null).map(() => 'a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error.message).to.contain('Request is made on the wrong network');
      });
  });
  it('should fail if broadhash is not hex', () => {
    const tmp: any = {...{}, ...headers};
    tmp.broadhash  = 'hh'
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('broadhash - Object didn\'t pass validation for format');
      });
  });
  it('should fail if height is string', () => {
    const tmp: any = {...{}, ...headers};
    tmp.height     = 'hh';
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('height - Expected type integer');
      });
  });
  it('should fail if nonce is less than 16 chars', () => {
    const tmp: any = {...{}, ...headers};
    tmp.nonce      = new Array(15).fill(null).fill('a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(res.body.error).to.contain('nonce - String is too short (15 chars)');
      });
  });
  it('should fail if nonce is longer than 36 chars', () => {
    const tmp: any = {...{}, ...headers};
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
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/list'));
    it('should return known peer (test peer)', () => {
      return supertest(initializer.appManager.expressApp)
        .get('/peer/list')
        .set(headers)
        .expect(200)
        .then((res) => {
          expect(res.body.peers).to.be.an('array');
          expect(res.body.peers.length).to.be.eq(1);
          const [peer] = res.body.peers;
          expect(Date.now() - peer.updated).to.be.lt(100);
          delete peer.updated;
          expect(peer).to.be.deep.eq({
            broadhash: null,
            clock    : null,
            dappid   : null,
            height   : null,
            ip       : '::ffff:127.0.0.1',
            os       : null,
            port     : 1,
            state    : 2,
            version  : '0.1.10',
          });
        });
    });
    it('should return other peers if inserted', () => {
      const peersLogic: IPeersLogic   = initializer.appManager.container.get(Symbols.logic.peers);
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
          expect(res.body.peers.length).to.be.eq(2);
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
      blocksModule = initializer.appManager.container.get(Symbols.modules.blocks);
      txModule     = initializer.appManager.container.get(Symbols.modules.transactions);
      txPool       = initializer.appManager.container.get(Symbols.logic.transactionPool);
      const {wallet} = await createRandomAccountWithFunds(Math.pow(10, 8));
      account = wallet;
    });
    afterEach(async () => {
      await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/peer/transactions'));
    it('should enqueue transaction', async () => {
      const tx = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const res = await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({transaction: tx})
        .expect(200);
      // console.log(await txModule.getByID(tx.id));
      expect(txPool.transactionInPool(tx.id)).is.true;
    });
    it('should enqueue bundled transactions', async () => {
      const tx = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const res = await supertest(initializer.appManager.expressApp)
        .post('/peer/transactions')
        .set(headers)
        .send({transactions: [tx, tx]})
        .expect(200);
      // console.log(await txModule.getByID(tx.id));
      expect(txPool.transactionInPool(tx.id)).is.true;
    });
    it('should validate transactions');
    it('should validate transaction');
  });

  describe('/blocks/common', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/peer/blocks/common'));
    it('should throw if given ids is not csv');
    it('should throw and remove querying peer if one or many ids are not numeric');
    it('should return commonblocks if any');
    it('should return null if no common blocks');
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
