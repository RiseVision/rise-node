import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { Op } from 'sequelize';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { TransactionsAPI } from '../../../src/apis';
import * as helpers from '../../../src/helpers';
import { Slots, TransactionType } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { TransactionsModuleStub, ZSchemaStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { TransactionsModel } from '../../../src/models';
import BlocksModuleStub from '../../stubs/modules/BlocksModuleStub';
import TransportModuleStub from '../../stubs/modules/TransportModuleStub';
import TransactionLogicStub from '../../stubs/logic/TransactionLogicStub';

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
  let transactionsModuleStub: TransactionsModuleStub;
  let txLogicStub: TransactionLogicStub;
  let transportModuleStub: TransportModuleStub
  let castSpy: any;
  let schema: ZSchemaStub;
  let dummyTxs: any;

  let transactionsModel: typeof TransactionsModel;
  let blocksModuleStub: BlocksModuleStub;

  beforeEach(() => {
    container = createContainer();
    sandbox   = sinon.createSandbox();

    container
      .bind(Symbols.api.transactions)
      .to(TransactionsAPI)
      .inSingletonScope();
    dummyTxs               = [
      { id: 100, senderPublicKey: Buffer.from('aa', 'hex'), recipientId: 'bb' },
      { id: 200, senderPublicKey: Buffer.from('aa', 'hex'), recipientId: 'bb' },
      { id: 300, senderPublicKey: Buffer.from('cc', 'hex'), recipientId: 'bb' },
      { id: 400, senderPublicKey: Buffer.from('aa', 'hex'), recipientId: 'dd' },
      { id: 500, senderPublicKey: Buffer.from('cc', 'hex'), recipientId: 'dd' },
    ];
    transactionsModuleStub = container.get(Symbols.modules.transactions);
    transactionsModuleStub.enqueueResponse(
      'list',
      Promise.resolve({ transactions: [], count: 0 })
    );
    transactionsModuleStub.enqueueResponse(
      'count',
      Promise.resolve({
        confirmed     : 1,
        multisignature: 2,
        queued        : 3,
        unconfirmed   : 4,
      })
    );
    transactionsModuleStub.enqueueResponse(
      'getByID',
      Promise.resolve(new TransactionsModel({
        id   : 456,
        type : TransactionType.VOTE,
      } as any))
    );
    transactionsModuleStub.enqueueResponse(
      'getMultisignatureTransactionList',
      dummyTxs
    );
    transactionsModuleStub.enqueueResponse('getMultisignatureTransaction', {
      id: '123',
    });
    transactionsModuleStub.enqueueResponse(
      'getQueuedTransactionList',
      dummyTxs
    );
    transactionsModuleStub.enqueueResponse(
      'getUnconfirmedTransactionList',
      dummyTxs
    );
    transactionsModuleStub.enqueueResponse('getUnconfirmedTransaction', {
      id: '123',
    });
    castSpy = sandbox.spy(helpers, 'castFieldsToNumberUsingSchema');
    schema  = container.get(Symbols.generic.zschema);
    schema.enqueueResponse('validate', true);
    schema.enqueueResponse('getLastError', {
      details: [{ path: '/foo/bar' }],
    });
    schema.enqueueResponse('getLastErrors', [{ message: 'Schema error' }]);
    container.rebind(Symbols.helpers.slots).to(Slots).inSingletonScope();
    instance          = container.get(Symbols.api.transactions);
    transactionsModel = container.get(Symbols.models.transactions);
    blocksModuleStub  = container.get<BlocksModuleStub>(Symbols.modules.blocks);
    transportModuleStub = container.get(Symbols.modules.transport);
    txLogicStub = container.get(Symbols.logic.transaction);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getTransactions()', () => {
    let findAndCountAllStub: SinonStub;
    beforeEach(() => {
      findAndCountAllStub = sandbox.stub(transactionsModel, 'findAndCountAll').resolves({ rows: [], count: 0 });
    });
    it('should return an object with the properties: transactions and count', async () => {

      const body            = {
        blockId            : '100',
        fromHeight         : '123',
        recipientIds       : 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys   : 'g,h,i',
      };
      body['and:senderIds'] = 'a,b,c';
      result                = await instance.getTransactions(body);
      expect(result).to.deep.equal({ transactions: [], count: 0 });
      expect(castSpy.calledOnce).to.be.true;
      expect(castSpy.args[0][1]).to.deep.equal({
        'and:senderIds'      : ['a', 'b', 'c'],
        'blockId'            : '100',
        'fromHeight'         : 123,
        'recipientIds'       : ['d', 'e', 'f'],
        'recipientPublicKeys': ['j', 'k', 'l'],
        'senderPublicKeys'   : ['g', 'h', 'i'],
      });
    });

    it('Schema error', async () => {
      schema.stubs.validate.returns(false);
      const body = {
        blockId            : '100',
        fromHeight         : '123',
        recipientIds       : 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys   : 'g,h,i',
      };
      await expect(instance.getTransactions(body)).to.be.rejectedWith(
        'Schema error'
      );
    });

    it('Failed to get transactions', async () => {
      findAndCountAllStub.rejects(new Error('Failed to get transactions'));
      const body = {
        blockId            : '100',
        fromHeight         : '123',
        recipientIds       : 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys   : 'g,h,i',
      };
      await expect(instance.getTransactions(body)).to.be.rejectedWith(
        'Failed to get transactions'
      );
    });

    describe('inputParams checks', () => {
      it('test 1 with just "not" and params', async () => {
        await instance.getTransactions({
          senderIds   : '1,2,3,4',
          recipientIds: '5,6,7,8',
          blockId     : '1',
          type        : 0,
          senderId    : 'extra',
          recipientId : 'extraRec',
          fromHeight  : 10,
          toHeight    : 20,
          minAmount   : 30,
          maxAmount   : 40,
          limit       : 50,
          offset      : 10,
          orderBy     : 'height:asc'
        });
        expect(findAndCountAllStub.firstCall.args[0].limit).to.be.eq(50);
        expect(findAndCountAllStub.firstCall.args[0].offset).to.be.eq(10);
        expect(findAndCountAllStub.firstCall.args[0].order).to.be.deep.eq([['height', 'asc']]);

        // Only the Op.or should be included which is not returned here.
        expect(Object.keys(findAndCountAllStub.firstCall.args[0].where).length).to.be.eq(0);
        // expect(findAndCountAllStub.firstCall.args[0].where[Op.or]).to.be.deep.eq

        const where = findAndCountAllStub.firstCall.args[0].where[Op.or];
        expect(where.amount[Op.lte]).to.be.eq(40);
        expect(where.amount[Op.gte]).to.be.eq(30);

        expect(where.blockId[Op.eq]).to.be.eq('1');

        expect(where.height[Op.lte]).to.be.eq(20);
        expect(where.height[Op.gte]).to.be.eq(10);

        expect(where.recipientId[Op.in]).to.be.deep.eq(['5', '6', '7', '8', 'EXTRAREC']);
        expect(where.senderId[Op.in]).to.be.deep.eq(['1', '2', '3', '4', 'EXTRA']);

        expect(where.type[Op.eq]).to.be.deep.eq(0);
      });
      it('test 1 with ALL params', async () => {
        blocksModuleStub.lastBlock = { height: 1000 } as any;
        await instance.getTransactions({
          'and:senderIds'       : '9,10,11',
          'and:recipientIds'    : '5,6,7,8',
          'and:type'            : 1,
          'and:senderId'        : '13',
          'and:senderPublicKeys' : 'cc,dd',
          'and:senderPublicKey' : 'aa',
          'and:recipientId'     : '14',
          'and:fromHeight'      : 100,
          'and:toHeight'        : 120,
          'and:fromTimestamp'   : 120,
          'and:toTimestamp'     : 120,
          'and:fromUnixTime'    : 130,
          'and:toUnixTime'      : 140,
          'and:minAmount'       : 150,
          'and:maxAmount'       : 160,
          'and:minConfirmations': 170,
          blockId               : '1',
          senderIds             : '1,2,3,4',
          recipientIds          : '5,6,7,8',
          type                  : 0,
          senderId              : 'overriddensender',
          recipientId           : 'overriddenrec',
          fromHeight            : 10,
          toHeight              : 20,
          minAmount             : 30,
          maxAmount             : 40,
          limit                 : 50,
          offset                : 10,
          fromTimestamp         : 70,
          toTimestamp           : 80,
          fromUnixTime          : 60,
          toUnixTime            : 70,
          minConfirmations      : 80,
          orderBy               : 'height:asc'
        });
        expect(findAndCountAllStub.firstCall.args[0].limit).to.be.eq(50);
        expect(findAndCountAllStub.firstCall.args[0].offset).to.be.eq(10);
        expect(findAndCountAllStub.firstCall.args[0].order).to.be.deep.eq([['height', 'asc']]);

        // Only the Op.or should be included which is not returned here.

        // expect(findAndCountAllStub.firstCall.args[0].where[Op.or]).to.be.deep.eq

        const where = findAndCountAllStub.firstCall.args[0].where;
        // Checking AND PARAMS
        expect(where.amount[Op.lte]).to.be.eq(160);
        expect(where.amount[Op.gte]).to.be.eq(150);
        expect(where.height[Op.gte]).to.be.eq(100);
        expect(where.height[Op.lte]).to.be.eq(120);
        expect(where.senderId[Op.in]).to.be.deep.eq(['9','10','11','13']);
        expect(where.senderPublicKey[Op.in]).to.be.deep.eq([
          Buffer.from('cc', 'hex'),
          Buffer.from('dd', 'hex'),
          Buffer.from('aa', 'hex'),
        ]);
        expect(where.timestamp[Op.lte]).to.be.deep.eq(-1464109200);
        expect(where.timestamp[Op.gte]).to.be.deep.eq(120);
        expect(where.type[Op.eq]).to.be.deep.eq(1);

        expect(where[Op.or].amount[Op.lte]).to.be.eq(40);
        expect(where[Op.or].amount[Op.gte]).to.be.eq(30);

        expect(where[Op.or].blockId[Op.eq]).to.be.eq('1');

        expect(where[Op.or].height[Op.lte]).to.be.eq(20);
        expect(where[Op.or].height[Op.gte]).to.be.eq(10);

        expect(where[Op.or].recipientId[Op.in]).to.be.deep.eq(['5', '6', '7', '8', 'OVERRIDDENREC']);
        expect(where[Op.or].senderId[Op.in]).to.be.deep.eq(['1', '2', '3', '4', 'OVERRIDDENSENDER']);

        expect(where[Op.or].type[Op.eq]).to.be.deep.eq(0);
      });
    });

  });

  describe('getCount()', () => {
    it('should return an object with the properties: confirmed, multisignature, queued and unconfirmed', async () => {
      result = await instance.getCount();
      expect(result).to.deep.equal({
        confirmed     : 1,
        multisignature: 2,
        queued        : 3,
        unconfirmed   : 4,
      });
    });
  });

  describe('getTX()', () => {
    it('should return a transaction with a votes property if tx type is VOTE', async () => {
      txLogicStub.stubs.attachAssets.callsFake((txs) => {
        txs.forEach((tx) => {
          tx.asset = {
            votes: ['+100', '+50', '-25']
          };
        });
      });
      result   = await instance.getTX({ id: '123' });
      const tx = {
        asset: {
          votes: ['+100', '+50', '-25'],
        },
        id   : 456,
        type : TransactionType.VOTE,
        signatures: [],
        votes: {
          added  : ['100', '50'],
          deleted: ['25'],
        },
      };
      expect(result).to.deep.equal({ transaction: tx });
    });

    it('should return a transaction without a votes property if tx type is not VOTE', async () => {
      transactionsModuleStub.stubs.getByID.returns(
        Promise.resolve(new TransactionsModel({ id: 456, type: TransactionType.DELEGATE }))
      );
      txLogicStub.stubs.attachAssets.callsFake((txs) => {
        txs.forEach((tx) => {
          tx.asset = {
            delegate: {
              username: 'meow'
            },
          };
        });
      });
      result = await instance.getTX({ id: '123' });
      expect(result).to.deep.equal({
        transaction: {
          id: 456,
          type: TransactionType.DELEGATE,
          asset: {
            delegate: {
              username: 'meow',
            },
          },
          signatures: [],
        },
      });
    });
  });

  describe('getMultiSigs()', () => {
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getMultiSigs({
        address        : 'bb',
        senderPublicKey: 'aa',
      });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getMultiSigs({ senderPublicKey: 'aa' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getMultiSigs({ address: 'dd' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getMultiSigs({});
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 300, senderPublicKey: 'cc', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getMultiSig()', () => {
    it('should return an object with a transaction', async () => {
      result = await instance.getMultiSig('123');
      expect(result).to.deep.equal({ transaction: { id: '123' } });
    });

    it('should to be reject with the message \'Transaction not found\'', async () => {
      transactionsModuleStub.stubs.getMultisignatureTransaction.returns(
        undefined
      );
      await expect(instance.getMultiSig('123')).to.be.rejectedWith(
        'Transaction not found'
      );
    });
  });

  describe('getQueuedTx()', () => {
    it('should call transactionsModule.getQueuedTransaction and return transaction', async () => {
      const id          = 'id';
      const transaction = {};
      transactionsModuleStub.enqueueResponse(
        'getQueuedTransaction',
        transaction
      );
      expect(await instance.getQueuedTx(id)).to.be.deep.equal({ transaction });

      expect(transactionsModuleStub.stubs.getQueuedTransaction.calledOnce).to.be
        .true;
      expect(
        transactionsModuleStub.stubs.getQueuedTransaction.firstCall.args.length
      ).to.be.equal(1);
      expect(
        transactionsModuleStub.stubs.getQueuedTransaction.firstCall.args[0]
      ).to.be.equal(id);
    });
    it('should throw error if transaction is null', async () => {
      transactionsModuleStub.enqueueResponse('getQueuedTransaction', null);
      await expect(instance.getQueuedTx('id')).to.be.rejectedWith(
        'Transaction not found'
      );
    });
  });

  describe('getQueuedTxs()', () => {
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getQueuedTxs({
        address        : 'bb',
        senderPublicKey: 'aa',
      });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getQueuedTxs({ senderPublicKey: 'aa' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getQueuedTxs({ address: 'dd' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getQueuedTxs({});
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 300, senderPublicKey: 'cc', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getUnconfirmedTxs()', () => {
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getUnconfirmedTxs({
        address        : 'bb',
        senderPublicKey: 'aa',
      });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 300, senderPublicKey: 'cc', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
        ],
      });
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getUnconfirmedTxs({ senderPublicKey: 'aaa' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getUnconfirmedTxs({ address: 'dd' });
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getUnconfirmedTxs({});
      expect(result).to.deep.equal({
        count       : 5,
        transactions: [
          { id: 100, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 200, senderPublicKey: 'aa', recipientId: 'bb' },
          { id: 300, senderPublicKey: 'cc', recipientId: 'bb' },
          { id: 400, senderPublicKey: 'aa', recipientId: 'dd' },
          { id: 500, senderPublicKey: 'cc', recipientId: 'dd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getUnconfirmedTx()', () => {
    it('should return an object with a transaction', async () => {
      result = await instance.getUnconfirmedTx('123');
      expect(result).to.deep.equal({ transaction: { id: '123' } });
    });

    it('should to be reject with a message \'Transaction not found\'', async () => {
      transactionsModuleStub.stubs.getUnconfirmedTransaction.returns(undefined);
      await expect(instance.getUnconfirmedTx('123')).to.be.rejectedWith(
        'Transaction not found'
      );
    });
  });
  describe('put', () => {
    it('should throw if no transaction is provided', async () => {
      await expect(instance.put(null))
        .to.be.rejectedWith('Transaction not provided');
    });
    it('should call transportModule.receiveTransactions with proper params', async () => {
      transportModuleStub.stubs.receiveTransactions.resolves();
      await instance.put({the: 'tx'} as any);
      expect(transportModuleStub.stubs.receiveTransactions.calledOnce).is.true;
      expect(transportModuleStub.stubs.receiveTransactions.firstCall.args).deep.eq([
        [{the: 'tx'}],
        null, // peer,
        true, // Broadcast
      ]);
    });
    it('should reject if receiveTransactions rejects', async () => {
      transportModuleStub.stubs.receiveTransactions.rejects(new Error('meow'));
      await expect(instance.put({} as any)).to.be.rejectedWith('meow');
    });
  });
});
