import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { Op } from 'sequelize';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionsAPI, TXApiGetTxFilter, TXSymbols } from '../../src';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import {
  IAccountsModule,
  IBlocksModule,
  ITransactionsModule,
  ITransportModule
} from '../../../core-interfaces/src/modules';
import { ITransactionLogic, ITransactionPoolLogic } from '../../../core-interfaces/src/logic';
import { ITransactionsModel } from '../../../core-interfaces/src/models';
import { Symbols } from '../../../core-interfaces/src';
import { APISymbols } from '../../../core-apis/src/helpers';
import { ModelSymbols } from '../../../core-models/src/helpers';
import { LiskWallet } from 'dpos-offline';
import * as uuid from 'uuid';
import { createRandomTransaction, createRandomTransactions, toBufferedTransaction } from '../utils/txCrafter';
import { IBaseTransaction, ITransportTransaction } from '../../../core-types/src';
import { ITransaction } from 'dpos-offline/dist/es5/trxTypes/BaseTx';

// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect       = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/transactionsAPI', () => {
  let sandbox: SinonSandbox;
  let instance: TransactionsAPI;
  let container: Container;
  let result: any;
  let txModule: ITransactionsModule;
  let txLogic: ITransactionLogic;
  let transportModule: ITransportModule;
  let hookSystem: WordPressHookSystem;
  let TransactionsModel: typeof ITransactionsModel;
  let blocksModule: IBlocksModule;

  beforeEach(async () => {
    container = await createContainer(['core-transactions', 'core-helpers', 'core-blocks', 'core', 'core-accounts']);
    sandbox   = sinon.createSandbox();
    txModule  = container.get(TXSymbols.module);

    instance          = container.getNamed(APISymbols.api, TXSymbols.api.api);
    TransactionsModel = container.getNamed(ModelSymbols.model, Symbols.models.transactions);
    transportModule   = container.get(Symbols.modules.transport);
    blocksModule      = container.get<IBlocksModule>(Symbols.modules.blocks);
    txLogic           = container.get(Symbols.logic.transaction);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getTransactions()', () => {
    let findAndCountAllStub: SinonStub;
    beforeEach(() => {
      findAndCountAllStub = sandbox.stub(TransactionsModel, 'findAndCountAll').resolves({ rows: [], count: 0 });
    });
    it('should query for data with proper manipulation (casted numbers, bufferd publickeys and untouched elements', async () => {
      const accounts = new Array(3).fill(null).map(() => new LiskWallet(uuid.v4(), 'R'));
      const body     = {
        blockId         : '100',
        fromHeight      : '123',
        recipientIds    : accounts.map((acc) => acc.address).join(','),
        senderPublicKeys: accounts.map((acc) => acc.publicKey).join(','),
      };
      // body['and:senderIds'] = 'a,b,c';
      result         = await instance.getTransactions(body);
      expect(result).to.deep.equal({ transactions: [], count: 0 });
      // fromHeight should be casted to integer
      expect(findAndCountAllStub.firstCall.args[0].where[Op.or].height[Op.gte]).deep.eq(123);
      // blockId untouched
      expect(findAndCountAllStub.firstCall.args[0].where[Op.or].blockId[Op.eq]).deep.eq('100');

      // recipients arrayified from csv
      expect(findAndCountAllStub.firstCall.args[0].where[Op.or].recipientId[Op.in])
        .deep.eq(accounts.map((acc) => acc.address));

      // publickeys parsed to buffer.
      expect(findAndCountAllStub.firstCall.args[0].where[Op.or]
        .senderPublicKey[Op.in]).deep.eq(accounts.map((acc) => Buffer.from(acc.publicKey, 'hex')));
    });

    it('Schema error', async () => {
      const invalidEntries = [
        { blockId: 'meow' },
        { fromHeight: 'haha' },
        { fromHeight: '-1' },
        { toHeight: 'haha' },
        { toHeight: '-1' },
        { fromUnixTime: '-1' },
        { toUnixTime: '-1' },
        { height: '-1' },
        { height: '0' },
        { recipientId: 'not an address' },
        { recipientIds: 'not an address,1R' },
        { senderPublicKey: 'not a pkey' },
        { senderPublicKeys: 'not a pkey,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
        { invalidParam: 'whatever' },
        { orderBy: 'not an ordering mechanism' },
      ];

      for (const invalid of invalidEntries) {
        await expect(instance.getTransactions(invalid)).to.be.rejected;
      }
    });

    it('should return manipulated data from findAndCountAll', async () => {
      findAndCountAllStub.resolves({ rows: [], count: 0 });
      const res = await instance.getTransactions({});
      expect(res).deep.eq({
        count       : 0,
        transactions: [],
      });
    });
    it('should use limit, offset and order param', async () => {
      findAndCountAllStub.resolves({ rows: [], count: 0 });
      await instance.getTransactions({ orderBy: 'height:desc', limit: 10, offset: 20 });
      expect(findAndCountAllStub.firstCall.args[0]).deep.eq({
        limit : 10,
        offset: 20,
        order : [['height', 'desc']],
        where : {},
      });
    });
  });

  describe('getCount()', () => {
    it('should return an object with the properties: confirmed, multisignature, queued and unconfirmed', async () => {
      sandbox.stub(txModule, 'count').resolves('meow');
      result = await instance.getCount();
      expect(result).to.deep.equal('meow');
    });
  });

  describe('getTX()', () => {
    let getByIDStub: SinonStub;
    beforeEach(() => {
      getByIDStub = sandbox.stub(txModule, 'getByID');
    });

    it('should return tx with attached assets and passed through filter.', async () => {
      const t  = createRandomTransaction();
      const tx = toBufferedTransaction(t);
      getByIDStub.resolves(new TransactionsModel(tx));
      const attachAssetsStub = sandbox.stub(txLogic, 'attachAssets').callsFake((txs) => {
        txs.forEach((tx) => {
          tx.asset = { delegate: { username: 'meow' } };
        });
      });

      // Attach something via filter
      class Hey extends WPHooksSubscriber(Object) {
        public hookSystem: WordPressHookSystem = container.get(Symbols.generic.hookSystem);

        @TXApiGetTxFilter()
        public async filterTx(ta: ITransportTransaction<any>) {
          ta['cat'] = 'meows';
          return ta;
        }
      }

      const h = new Hey();
      await h.hookMethods();

      result = await instance.getTX({ id: '123' });
      expect(result).to.deep.equal({
        transaction: {
          ...t,
          // asset
          asset        : {
            delegate: { username: 'meow' },
          },
          signatures   : [],
          signSignature: null,
          // Filter
          cat          : 'meows',
        },
      });

      await h.unHook();
    });
  });
  //
  // describe('getMultiSigs()', () => {
  //   it('filtering by senderPublicKey &  address', async () => {
  //     result = await instance.getMultiSigs({
  //       address        : 'bb',
  //       senderPublicKey: 'aa',
  //     });
  //     expect(result).to.deep.equal({
  //       count       : 5,
  //       transactions: [
  //         { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
  //         { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
  //       ],
  //     });
  //     expect(result.transactions).to.be.ofSize(2);
  //   });
  //
  //   it('filtering by senderPublicKey', async () => {
  //     result = await instance.getMultiSigs({ senderPublicKey: 'aa' });
  //     expect(result).to.deep.equal({
  //       count       : 5,
  //       transactions: [
  //         { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
  //         { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
  //         { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
  //       ],
  //     });
  //     expect(result.transactions).to.be.ofSize(3);
  //   });
  //
  //   it('filtering by address', async () => {
  //     result = await instance.getMultiSigs({ address: 'dd' });
  //     expect(result).to.deep.equal({
  //       count       : 5,
  //       transactions: [
  //         { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
  //         { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
  //       ],
  //     });
  //     expect(result.transactions).to.be.ofSize(2);
  //   });
  //
  //   it('No filters', async () => {
  //     result = await instance.getMultiSigs({});
  //     expect(result).to.deep.equal({
  //       count       : 5,
  //       transactions: [
  //         { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
  //         { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
  //         { id: 300, senderPublicKey: 'cc', recipientId: 'bb' },
  //         { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
  //         { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
  //       ],
  //     });
  //     expect(result.transactions).to.be.ofSize(5);
  //   });
  // });
  //
  // describe('getMultiSig()', () => {
  //   it('should return an object with a transaction', async () => {
  //     result = await instance.getMultiSig('123');
  //     expect(result).to.deep.equal({ transaction: { id: '123' } });
  //   });
  //
  //   it('should to be reject with the message \'Transaction not found\'', async () => {
  //     transactionsModuleStub.stubs.getMultisignatureTransaction.returns(
  //       undefined
  //     );
  //     await expect(instance.getMultiSig('123')).to.be.rejectedWith(
  //       'Transaction not found'
  //     );
  //   });
  // });
  //
  describe('getQueuedTx()', () => {
    it('should throw if id is not valid', async () => {
      await expect(instance.getQueuedTx('not an id')).rejectedWith('not an id');
    });

    it('should call transactionsModule.getQueuedTransaction and return transaction', async () => {
      const id                      = '1';
      const transaction             = {};
      const getQueueTransactionStub = sandbox.stub(txModule, 'getQueuedTransaction').returns(transaction);
      expect(await instance.getQueuedTx(id)).to.be.deep.equal({ transaction });

      expect(getQueueTransactionStub.calledOnce).to.be
        .true;
      expect(
        getQueueTransactionStub.firstCall.args.length
      ).to.be.equal(1);
      expect(
        getQueueTransactionStub.firstCall.args[0]
      ).to.be.equal(id);
    });

    it('should throw error if transaction is null', async () => {
      const getQueueTransactionStub = sandbox.stub(txModule, 'getQueuedTransaction').returns(null);
      await expect(instance.getQueuedTx('1')).to.be.rejectedWith(
        'Transaction not found'
      );
    });
  });

  describe('getQueuedTxs()', () => {
    let transportTxs: Array<ITransaction<any>>;
    let txs: Array<IBaseTransaction<any>>;
    beforeEach(() => {
      const txPool: ITransactionPoolLogic = container.get(TXSymbols.pool);

      transportTxs = new Array(5).fill(null).map(() => createRandomTransaction());
      txs          = transportTxs.map((t) => toBufferedTransaction(t));

      txs.forEach((tx) => txPool.queued.add(tx));
    })
    it('filtering by senderPublicKey & address', async () => {
      result = await instance.getQueuedTxs({
        address        : transportTxs[0].recipientId,
        senderPublicKey: transportTxs[0].senderPublicKey,
      });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { ...transportTxs[0], signSignature: null },
        ],
      });
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getQueuedTxs({ senderPublicKey: transportTxs[1].senderPublicKey });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { ...transportTxs[1], signSignature: null },
        ],
      });
    });

    it('filtering by recipientId', async () => {
      result = await instance.getQueuedTxs({ address: transportTxs[2].recipientId });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { ...transportTxs[2], signSignature: null },
        ],
      });
    });

    it('No filters', async () => {
      result = await instance.getQueuedTxs({});
      expect(result).to.deep.equal({
        count       : 5,
        transactions: transportTxs.reverse().map((tx) => ({ ...tx, signSignature: null })),
      });
    });

  });

  describe('getUnconfirmedTxs()', () => {
    let transportTXS: ITransaction[];
    beforeEach(() => {
      const txPool: ITransactionPoolLogic = container.get(TXSymbols.pool);
      transportTXS = createRandomTransactions(5);
      transportTXS.forEach((t) => txPool.unconfirmed.add(toBufferedTransaction(t)));
    });
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getUnconfirmedTxs({
        address        : transportTXS[0].recipientId,
        senderPublicKey: transportTXS[1].senderPublicKey,
      });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          {...transportTXS[1], signSignature: null},
          {...transportTXS[0], signSignature: null},
        ],
      });
    });

    it('No filters', async () => {
      result = await instance.getUnconfirmedTxs({});
      expect(result).to.deep.equal({
        count       : 5,
        transactions: transportTXS.reverse().map((tx) => ({ ...tx, signSignature: null })),
      });
    });
  });

  describe('getUnconfirmedTx()', () => {
    it('should throw tx not found if not in queue', async () => {
      await expect(instance.getUnconfirmedTx('123')).to.be.rejectedWith(
          'Transaction not found'
        );
    });

    it('should to be reject with a message \'Transaction not found\'', async () => {
      const t = createRandomTransaction();
      const txPool: ITransactionPoolLogic = container.get(TXSymbols.pool);
      txPool.unconfirmed.add(toBufferedTransaction(t));
      const r = await instance.getUnconfirmedTx(t.id);
      expect(r).deep.eq({transaction: {...t, signSignature: null, requesterPublicKey: null}});
    });
  });
  describe('put', () => {
    let accModule: IAccountsModule;
    let resolveAccTransactionStub: SinonStub;
    beforeEach(() => {
      accModule                 = container.get(Symbols.modules.accounts);
      resolveAccTransactionStub = sandbox.stub(accModule, 'resolveAccountsForTransactions').resolves({});
    });

    it('should respond correctly even if no transaction is provided', async () => {
      const res = await instance.put({});

      expect(res).deep.eq({
        accepted: [],
        invalid : [],
      });
    });
    it('should validate transactions', async () => {
      await expect(instance.put({ transactions: 'asd' } as any))
        .to.be.rejectedWith('Expected type array');
      await expect(instance.put({ transactions: new Array(11).fill('miao') } as any))
        .to.be.rejectedWith('Array is too long (11)');
    });

    it('should return invalid if any of the tx is valid', async () => {
      const txs    = createRandomTransactions(3);
      const objNormalizeStub = sandbox.stub(txLogic, 'objectNormalize').throws(new Error('cant normalize'));
      const ret              = await instance.put({ transaction: txs[0], transactions: txs.slice(1) });

      expect(ret).deep.eq({
        accepted: [],
        invalid : [
          { id: txs[0].id, reason: 'cant normalize' },
          { id: txs[1].id, reason: 'cant normalize' },
          { id: txs[2].id, reason: 'cant normalize' }
        ],
      });
    });

    it('should filter out only valid transactions', async () => {
      blocksModule.lastBlock = { height: 100 }  as any;
      const objNormalizeStub = sandbox.stub(txLogic, 'objectNormalize').callsFake((t) => t);
      objNormalizeStub.onFirstCall().throws(new Error('objectNormalize'));
      // Create some txs.
      const txs    = createRandomTransactions(8);
      const sendTX = createRandomTransaction();
      resolveAccTransactionStub.resolves({ resolve: 'accounts' });
      let count         = 0;
      const filteredTxs = []; // sendtx is filtered through objectNormalize
      const validTXs    = [];

      sandbox.stub(txModule, 'checkTransaction').callsFake((tx) => {
        if (count++ % 2 === 0) {
          filteredTxs.push(tx);
          return Promise.reject(new Error('meow'));
        }
        validTXs.push(tx);
        return Promise.resolve();
      });
      sandbox.stub(txModule, 'processIncomingTransactions').resolves();

      const res = await instance.put({ transaction: sendTX, transactions: txs });
      expect(res).deep.eq({
        accepted: validTXs.map((t) => t.id),
        invalid : [{ id: sendTX.id, reason: 'objectNormalize' }].concat(... filteredTxs.map((t) => ({
          id    : t.id,
          reason: 'meow'
        }))),
      });
      // check calling parameters.
    });
  });
});
