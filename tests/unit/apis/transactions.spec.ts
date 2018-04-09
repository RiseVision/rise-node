import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { TransactionsAPI } from '../../../src/apis/transactions';
import { TransactionType } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { TransactionsModuleStub, ZSchemaStub } from '../../stubs';
import { createContainer } from '../../utils/containerCreator';

const rewired = rewire('../../../src/helpers/decorators/schemavalidators');
// tslint:disable-next-line no-var-requires
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

// tslint:disable no-unused-expression
describe('apis/transactionsAPI', () => {
  let sandbox: SinonSandbox;
  let instance: TransactionsAPI;
  let container: Container;
  let result: any;
  let transactionsModuleStub: TransactionsModuleStub;
  let helper: any;
  let castSpy: any;
  let schema: ZSchemaStub;
  let dummyTxs: any;

  beforeEach(() => {
    container = createContainer();
    sandbox = sinon.sandbox.create();
    container
      .bind(Symbols.api.transactions)
      .to(TransactionsAPI)
      .inSingletonScope();
    dummyTxs = [
      { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
      { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
      { id: 300, senderPublicKey: 'ccc', recipientId: 'bbb' },
      { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
      { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
    ];
    transactionsModuleStub = container.get(Symbols.modules.transactions);
    transactionsModuleStub.enqueueResponse(
      'list',
      Promise.resolve({ transactions: [], count: 0 })
    );
    transactionsModuleStub.enqueueResponse(
      'count',
      Promise.resolve({
        confirmed: 1,
        multisignature: 2,
        queued: 3,
        unconfirmed: 4,
      })
    );
    transactionsModuleStub.enqueueResponse(
      'getByID',
      Promise.resolve({
        asset: { votes: ['+100', '+50', '-25'] },
        id: 456,
        type: TransactionType.VOTE,
      })
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
    helper = rewired.__get__('_1');
    castSpy = sandbox.spy(helper, 'castFieldsToNumberUsingSchema');
    schema = container.get(Symbols.generic.zschema);
    schema.enqueueResponse('validate', true);
    schema.enqueueResponse('getLastError', {
      details: [{ path: '/foo/bar' }],
    });
    schema.enqueueResponse('getLastErrors', [{ message: 'Schema error' }]);
    instance = container.get(Symbols.api.transactions);
  });

  afterEach(() => {
    sandbox.restore();
    sandbox.resetHistory();
  });

  describe('getTransactions()', () => {
    it('success', async () => {
      const body = {
        blockId: '100',
        fromHeight: '123',
        recipientIds: 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys: 'g,h,i',
      };
      body['and:senderIds'] = 'a,b,c';
      result = await instance.getTransactions(body);
      expect(result).to.deep.equal({ transactions: [], count: 0 });
      expect(castSpy.calledOnce).to.be.true;
      expect(castSpy.args[0][1]).to.deep.equal({
        'and:senderIds': ['a', 'b', 'c'],
        'blockId': '100',
        'fromHeight': 123,
        'recipientIds': ['d', 'e', 'f'],
        'recipientPublicKeys': ['j', 'k', 'l'],
        'senderPublicKeys': ['g', 'h', 'i'],
      });
    });

    it('Schema error', async () => {
      schema.stubs.validate.returns(false);
      const body = {
        blockId: '100',
        fromHeight: '123',
        recipientIds: 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys: 'g,h,i',
      };
      await expect(instance.getTransactions(body)).to.be.rejectedWith(
        'Schema error'
      );
    });

    it('Failed to get transactions', async () => {
      transactionsModuleStub.stubs.list.returns(Promise.reject(false));
      const body = {
        blockId: '100',
        fromHeight: '123',
        recipientIds: 'd,e,f',
        recipientPublicKeys: 'j,k,l',
        senderPublicKeys: 'g,h,i',
      };
      await expect(instance.getTransactions(body)).to.be.rejectedWith(
        'Failed to get transactions'
      );
    });
  });

  describe('getCount()', () => {
    it('success', async () => {
      result = await instance.getCount();
      expect(result).to.deep.equal({
        confirmed: 1,
        multisignature: 2,
        queued: 3,
        unconfirmed: 4,
      });
    });
  });

  describe('getTX()', () => {
    it('should return a transaction with a votes property if tx type is VOTE', async () => {
      result = await instance.getTX({id: '123'});
      const tx = {
        asset: {
          votes: ['+100', '+50', '-25'],
        },
        id: 456,
        type: TransactionType.VOTE,
        votes: {
          added: ['100', '50'],
          deleted: ['25'],
        },
      };
      expect(result).to.deep.equal({ transaction: tx });
    });

    it('should return a transaction without a votes property if tx type is not VOTE', async () => {
      transactionsModuleStub.stubs.getByID.returns(
        Promise.resolve({ id: 456, type: TransactionType.DELEGATE })
      );
      result = await instance.getTX('123');
      expect(result).to.deep.equal({
        transaction: { id: 456, type: TransactionType.DELEGATE },
      });
    });
  });

  describe('getMultiSigs()', () => {
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getMultiSigs({
        address: 'bbb',
        senderPublicKey: 'aaa',
      });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getMultiSigs({ senderPublicKey: 'aaa' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getMultiSigs({ address: 'ddd' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getMultiSigs({});
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 300, senderPublicKey: 'ccc', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getMultiSig()', () => {
    it('success', async () => {
      result = await instance.getMultiSig('123');
      expect(result).to.deep.equal({ transaction: { id: '123' } });
    });

    it('fail', async () => {
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
      const id = 'id';
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
        address: 'bbb',
        senderPublicKey: 'aaa',
      });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getQueuedTxs({ senderPublicKey: 'aaa' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getQueuedTxs({ address: 'ddd' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getQueuedTxs({});
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 300, senderPublicKey: 'ccc', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getUnconfirmedTxs()', () => {
    it('filtering by senderPublicKey &  address', async () => {
      result = await instance.getUnconfirmedTxs({
        address: 'bbb',
        senderPublicKey: 'aaa',
      });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('filtering by senderPublicKey', async () => {
      result = await instance.getUnconfirmedTxs({ senderPublicKey: 'aaa' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(3);
    });

    it('filtering by address', async () => {
      result = await instance.getUnconfirmedTxs({ address: 'ddd' });
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(2);
    });

    it('No filters', async () => {
      result = await instance.getUnconfirmedTxs({});
      expect(result).to.deep.equal({
        count: 5,
        transactions: [
          { id: 100, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 200, senderPublicKey: 'aaa', recipientId: 'bbb' },
          { id: 300, senderPublicKey: 'ccc', recipientId: 'bbb' },
          { id: 400, senderPublicKey: 'aaa', recipientId: 'ddd' },
          { id: 500, senderPublicKey: 'ccc', recipientId: 'ddd' },
        ],
      });
      expect(result.transactions).to.be.ofSize(5);
    });
  });

  describe('getUnconfirmedTx()', () => {
    it('success', async () => {
      result = await instance.getUnconfirmedTx('123');
      expect(result).to.deep.equal({ transaction: { id: '123' } });
    });

    it('fail', async () => {
      transactionsModuleStub.stubs.getUnconfirmedTransaction.returns(undefined);
      await expect(instance.getUnconfirmedTx('123')).to.be.rejectedWith(
        'Transaction not found'
      );
    });
  });
  describe('put', () => {
    it('should throw error', async () => {
      await expect(instance.put()).to.be.rejectedWith('Method is deprecated');
    });
  });
});
