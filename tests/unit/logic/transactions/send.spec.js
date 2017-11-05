'use strict';

const chai = require("chai");
let chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;
const sinon = require("sinon");
const rewire = require("rewire");
const SendTransaction = require("../../../../logic/transactions/send").SendTransaction;
const BaseTransactionType = require("../../../../logic/transactions/baseTransactionType").BaseTransactionType;

chai.use(chaiAsPromised);


describe("logic/transfer", () => {
  let accounts, system, rounds, instance, tx, sender, block;

  beforeEach(() => {
    accounts = {
      setAccountAndGet: sinon.stub().resolves(),
      mergeAccountAndGet: sinon.stub().resolves()
    };
    system = {
      getFees: sinon.stub().returns({
        fees: {
          send: 1
        }
      })
    };
    rounds = {
      calc: sinon.stub().returns(10)
    };
    tx = {
      recipientId: 'carbonara',
      amount: 10
    };
    sender = {};
    block = {
      id: 'carbonara',
      height: 'tall'
    };
    instance = new SendTransaction();
    instance.bind(accounts, rounds, system);
  });

  describe("when is instantiated", () => {
    it("is instanceof BaseTransactionType", () => {
      expect(new SendTransaction()).is.an.instanceof(BaseTransactionType);
    });
  });

  describe("bind", () => {
    it("modules are correctly set up", () => {
      let expectedModules = {
        accounts,
        rounds,
        system
      };
      expect(instance.modules).to.deep.equal(expectedModules);
    });
  });

  describe("calculateFee", () => {
    it("calls getFees", () => {
      instance.calculateFee({}, {}, 10);
      expect(system.getFees.calledOnce).to.be.true;
      expect(system.getFees.firstCall.args.length).to.equal(1);
      expect(system.getFees.firstCall.args[0]).to.equal(10);
    });
  });

  describe("verify", () => {
    it("throws Missing recipient when !tx.recipientId", () => {
      expect(instance.verify({},sender)).to.be.rejectedWith('Missing recipient');
    });

    it("throws Invalid transaction amount when tx.amount <= 0", () => {
      tx.amount = 0;
      expect(instance.verify(tx,sender)).to.be.rejectedWith('Invalid transaction amount');
    });
    it("executes successfully", () => {
      expect(instance.verify(tx,sender)).to.be.fulfilled;
    });
  });

  describe("apply", () => {
    it("setAccountAndGet is called and throws error", () => {
      accounts.setAccountAndGet.rejects('error');
      instance.bind(accounts, rounds, system);

      expect(instance.apply(tx, block, sender)).to.be.rejectedWith('error');
    });
    it("setAccountAndGet is called and executes successfully", () => {

      expect(instance.apply(tx, block, sender)).to.be.fulfilled;
      expect(accounts.setAccountAndGet.calledOnce).to.be.true;
      expect(accounts.setAccountAndGet.firstCall.args.length).to.equal(2);
      expect(accounts.setAccountAndGet.firstCall.args[0]).to.deep.equal({ address: tx.recipientId });
      expect(accounts.setAccountAndGet.firstCall.args[1]).to.be.a('function');
    });
    it("mergeAccountAndGet is called and rejected the promise", () => {
      accounts.mergeAccountAndGet.rejects('error');
      instance.bind(accounts, rounds, system);

      expect(instance.apply(tx, block, sender)).to.be.rejectedWith('error');
    });
    it("setAccountAndGet is called and executes successfully", () => {
      expect(instance.apply(tx, block, sender)).to.be.fulfilled;
      expect(rounds.calc.calledOnce).to.be.true;
      expect(rounds.calc.firstCall.args.length).to.equal(1);
      expect(rounds.calc.firstCall.args[0]).to.equal(block.height);

      // TODO: BROKEN
      expect(accounts.mergeAccountAndGet.calledOnce).to.be.true; // <- is false...
      expect(accounts.mergeAccountAndGet.firstCall.args.length).to.equal(2);
      expect(accounts.mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
        address  : tx.recipientId,
        balance  : tx.amount,
        blockId  : block.id,
        round    : 10,
        u_balance: tx.amount,
      });
      expect(accounts.mergeAccountAndGet.firstCall.args[1]).to.be.a('function');
    });
  });

  describe("undo", () => {
    it("setAccountAndGet is called and throws error", () => {
      accounts.setAccountAndGet.rejects('error');
      instance.bind(accounts, rounds, system);

      expect(instance.undo(tx, block, sender)).to.be.rejectedWith('error');
    });
    it("setAccountAndGet is called and executes successfully", () => {

      expect(instance.undo(tx, block, sender)).to.be.fulfilled;
      expect(accounts.setAccountAndGet.calledOnce).to.be.true;
      expect(accounts.setAccountAndGet.firstCall.args.length).to.equal(2);
      expect(accounts.setAccountAndGet.firstCall.args[0]).to.deep.equal({ address: tx.recipientId });
      expect(accounts.setAccountAndGet.firstCall.args[1]).to.be.a('function');
    });
    it("mergeAccountAndGet is called and rejects the promise", () => {
      accounts.mergeAccountAndGet.rejects('error');
      instance.bind(accounts, rounds, system);

      expect(instance.undo(tx, block, sender)).to.be.rejectedWith('error');
    });
    it("setAccountAndGet is called and executes successfully", () => {

      expect(instance.undo(tx, block, sender)).to.be.fulfilled;
      expect(rounds.calc.calledOnce).to.be.true;
      expect(rounds.calc.firstCall.args.length).to.equal(1);
      expect(rounds.calc.firstCall.args[0]).to.equal(block.height);

      // TODO: BROKEN
      expect(accounts.mergeAccountAndGet.calledOnce).to.be.true; // <- is false...
      expect(accounts.mergeAccountAndGet.firstCall.args.length).to.equal(2);
      expect(accounts.mergeAccountAndGet.firstCall.args[0]).to.deep.equal({
        address  : tx.recipientId,
        balance  : -tx.amount,
        blockId  : block.id,
        round    : 10,
        u_balance: -tx.amount,
      });
      expect(accounts.mergeAccountAndGet.firstCall.args[1]).to.be.a('function');
    });
  });

  describe("objectNormalize", () => {
    it("returns the tx", () => {
      expect(instance.objectNormalize(tx)).to.deep.equal(tx);
    });
  });

  describe("dbRead", () => {
    it("returns null", () => {
      expect(instance.dbRead()).to.deep.equal(null);
    });
  });

  describe("dbSave", () => {
    it("returns null", () => {
      expect(instance.dbSave()).to.deep.equal(null);
    });
  });


});
