'use strict';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import {Container} from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import {Symbols} from '../../../../src/ioc/symbols';
import { SendTransaction } from '../../../../src/logic/transactions';
import { AccountLogicStub, RoundsLogicStub, SystemModuleStub } from '../../../stubs';
import { createContainer } from '../../../utils/containerCreator';

const expect = chai.expect;
chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('logic/transactions/send', () => {
  let sandbox: SinonSandbox;
  let roundsLogicStub: RoundsLogicStub;
  let accountLogicStub: AccountLogicStub;
  let systemModuleStub: SystemModuleStub;
  let container: Container;

  let instance: SendTransaction;
  let tx: any;
  let sender: any;
  let block: any;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    accountLogicStub = container.get(Symbols.logic.account);
    accountLogicStub.enqueueResponse('merge', [{foo: 'bar'}]);
    systemModuleStub = container.get(Symbols.modules.system);
    systemModuleStub.stubs.getFees.returns({
      fees: {
        send: 1,
      },
    });
    roundsLogicStub = container.get(Symbols.logic.rounds);
    roundsLogicStub.stubs.calcRound.returns(10);

    tx       = {
      amount     : 10,
      recipientId: '1234567890R',
    };
    sender   = { publicKey: '123' };
    block    = {
      height: 123456,
      id    : 'blockId',
    };

    container.bind(Symbols.logic.transactions.send).to(SendTransaction).inSingletonScope();
    instance = container.get(Symbols.logic.transactions.send);

    (instance as any).roundsLogic    = roundsLogicStub;
    (instance as any).systemModule   = systemModuleStub;
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('calculateFee', () => {
    it('should call systemModule.getFees', () => {
      instance.calculateFee(tx, sender, 10);
      expect(systemModuleStub.stubs.getFees.calledOnce).to.be.true;
      expect(systemModuleStub.stubs.getFees.firstCall.args.length).to.equal(1);
      expect(systemModuleStub.stubs.getFees.firstCall.args[0]).to.equal(10);
    });
  });

  describe('verify', () => {
    it('should throw Missing recipient when !tx.recipientId', async () => {
      await expect(instance.verify({} as any, sender)).to.be.rejectedWith('Missing recipient');
    });

    it('throws Invalid transaction amount when tx.amount <= 0', async () => {
      tx.amount = 0;
      await expect(instance.verify(tx, sender)).to.be.rejectedWith('Invalid transaction amount');
    });

    it('should resolce on successful execution', () => {
      expect(instance.verify(tx, sender)).to.be.fulfilled;
    });
  });

  describe('apply', () => {
    it('should return an array of objects', async () => {
      const result = await instance.apply(tx, block, sender);
      expect(result).to.be.an('array');
      expect(result[0]).to.be.an('object').that.includes.all.keys('model', 'type', 'values');
      expect(result[0].model).to.be.an('object');
      expect(result[0].type).to.equal('upsert');
      expect(result[0].values).to.deep.equal({address: '1234567890R'});
      expect(result[1]).to.deep.equal({foo: 'bar'});
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.args[0][0]).to.equal(tx.recipientId);
      expect(accountLogicStub.stubs.merge.args[0][1]).to.deep.equal({
        balance  : tx.amount,
        blockId  : block.id,
        round    : 10,
        u_balance: tx.amount,
      });
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
    });

    it('should to be rejected if accountLogic.merge() throws an error', async () => {
      const error = new Error('Fake Error!');
      accountLogicStub.stubs.merge.throws(error);
      await expect(instance.apply(tx, block, sender)).to.be.rejectedWith(error);
    });
  });

  describe('undo', () => {
    it('should return an array of objects', async () => {
      const result = await instance.undo(tx, block, sender);
      expect(result).to.be.an('array');
      expect(result[0]).to.be.an('object').that.includes.all.keys('model', 'type', 'values');
      expect(result[0].model).to.be.an('object');
      expect(result[0].type).to.equal('upsert');
      expect(result[0].values).to.deep.equal({address: '1234567890R'});
      expect(result[1]).to.deep.equal({foo: 'bar'});
      expect(accountLogicStub.stubs.merge.calledOnce).to.be.true;
      expect(accountLogicStub.stubs.merge.args[0][0]).to.equal(tx.recipientId);
      expect(accountLogicStub.stubs.merge.args[0][1]).to.deep.equal({
        balance  : -tx.amount,
        blockId  : block.id,
        round    : 10,
        u_balance: -tx.amount,
      });
      expect(roundsLogicStub.stubs.calcRound.calledOnce).to.be.true;
    });

    it('should to be rejected if accountLogic.merge() throws an error', async () => {
      const error = new Error('Fake Error!');
      accountLogicStub.stubs.merge.throws(error);
      await expect(instance.undo(tx, block, sender)).to.be.rejectedWith(error);
    });
  });

  describe('objectNormalize', () => {
    it('should return the tx', () => {
      expect(instance.objectNormalize(tx)).to.deep.equal(tx);
    });
  });

  describe('dbRead', () => {
    it('should return null', () => {
      expect(instance.dbRead({})).to.deep.equal(null);
    });
  });

  describe('dbSave', () => {
    it('should return null', () => {
      expect(instance.dbSave({} as any)).to.deep.equal(null);
    });
  });
});
