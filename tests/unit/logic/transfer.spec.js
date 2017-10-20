var chai = require('chai')
var expect = chai.expect
var sinon = require('sinon')
var rewire = require('rewire')
var Transfer = rewire('../../../logic/transfer')

describe('logic/transfer', function () {

	describe('when is imported', function () {
		it('should be a function', function () {
			expect(Transfer).to.be.a('function')
		})
	})

	describe('when is instantiated', function () {
		it('should be an object', function () {
			var transfer = new Transfer()
			expect(transfer).to.be.an.instanceof(Transfer)
		})
	})

	describe('bind()', function () {

		var transfer, accounts, rounds, system

		beforeEach(function () {
			accounts = 1
			rounds = 2
			system = 3
			transfer = new Transfer()
		})

		context('When we call to bind()', function () {
			it('should initialize modules properly', function () {
				transfer.bind(accounts, rounds, system)
				expect(Transfer.__get__('modules').accounts).to.equal(accounts)
				expect(Transfer.__get__('modules').rounds).to.equal(rounds)
				expect(Transfer.__get__('modules').system).to.equal(system)
			})
		})

	})

	describe('create()', function () {
		var transfer, data, trs

		beforeEach(function () {
			data = {recipientId: 1, amount: 2}
			trs = {recipientId: 0, amount: 0}
			transfer = new Transfer()
		})

		describe('when we call to create()', function () {
			it('trs should be initialized properly', function () {
				transfer.create(data, trs)
				expect(trs.recipientId).to.equal(data.recipientId)
				expect(trs.amount).to.equal(data.amount)
			})
		})

	})

	describe('calculateFee()', function () {

		var transfer, accounts, rounds, system, trs, sender, height, result

		beforeEach(function () {
			system = {getFees: function () {
				return {fees: {send: 123}}
			}}
			sinon.spy(system, 'getFees')
			transfer = new Transfer()
			transfer.bind(accounts, rounds, system)
			result = transfer.calculateFee(trs, sender, height)
		})

		describe('when we call to calculateFee()', function () {
			it('should call to getFees()', function () {
				expect(system.getFees.called).to.be.true
				expect(result).to.equal(123)
			})
		})

	})

	describe('verify()', function () {

		var transfer, trs_case_1, trs_case_2, trs_case_3, trs_case_4, sender, callback, clock

		beforeEach(function () {
			trs_case_1 = {recipientId: false, amount: 0}
			trs_case_2 = {recipientId: true, amount: -1}
			trs_case_3 = {recipientId: true, amount: 0}
			trs_case_4 = {recipientId: true, amount: 1}
			transfer = new Transfer()
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
		})

		afterEach(function () {
			callback.reset()
			clock.restore()
		})

		context('Case 1: if trs.recipientId is false', function () {
			it('should return an \'Missing recipient\' error', function () {
				transfer.verify(trs_case_1, sender, callback)
				clock.runAll()
				expect(callback.args[0][0]).contain('Missing recipient')
			})

		})

		context('Case 2: if trs.amount is less than zero', function () {
			it('should return an \'Invalid transaction amount\' error', function () {
				transfer.verify(trs_case_2, sender, callback)
				clock.runAll()
				expect(callback.args[0][0]).contain('Invalid transaction amount')
			})
		})

		context('Case 3: if trs.amount is equal to zero', function () {
			it('should return an \'Invalid transaction amount\' error', function () {
				transfer.verify(trs_case_3, sender, callback)
				clock.runAll()
				expect(callback.args[0][0]).contain('Invalid transaction amount')
			})
		})

		context('Case 4: if everything is ok', function () {
			it('should call to callback without errors and pass trs as secondary parameter', function () {
				transfer.verify(trs_case_4, sender, callback)
				clock.runAll()
				expect(callback.args[0][0]).to.be.null
				expect(callback.args[0][1]).to.deep.equal(trs_case_4)
				expect(callback.called).to.be.true
			})
		})

	})

	describe('process()', function () {

		var transfer, trs, sender, callback, clock

		beforeEach(function () {
			trs = {recipientId: true, amount: 1}
			transfer = new Transfer()
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
		})

		afterEach(function () {
			callback.reset()
			clock.restore()
		})

		context('when we call to process()', function () {
			it('should call to callback and pass trs as secondary parameter without errors', function () {
				transfer.process(trs, sender, callback)
				clock.runAll()
				expect(callback.args[0][0]).to.be.null
				expect(callback.args[0][1]).to.deep.equal(trs)
				expect(callback.called).to.be.true
			})
		})

	})

	describe('getBytes()', function () {
		it('should return null', function () {
			var transfer = new Transfer()
			var result = transfer.getBytes()
			expect(result).to.be.null
		})
	})

	describe('apply()', function () {

		var transfer, accounts, rounds, system, trs_case_1, trs_case_2, trs_case_3, block, sender, callback, clock

		beforeEach(function () {
			transfer = new Transfer()
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
			trs_case_1 = {recipientId: false, amount: false}
			trs_case_2 = {recipientId: true, amount: false}
			trs_case_3 = {recipientId: true, amount: true}
			block = {id: 1, height: 2}
			accounts = {setAccountAndGet: function (data, cb) {
				if (data.address) {
					setImmediate(cb, null, data)
				} else {
					setImmediate(cb, 'error1')
				}
			}, mergeAccountAndGet: function (data, cb) {
				if (data.amount) {
					setImmediate(cb, null)
				} else {
					setImmediate(cb, 'error2')
				}
			}}
			rounds = {calc: function (height) {
				return height
			}}
			sinon.spy(accounts, 'setAccountAndGet')
			sinon.spy(accounts, 'mergeAccountAndGet')
			sinon.spy(rounds, 'calc')
			transfer.bind(accounts, rounds, system)
		})

		afterEach(function () {
			callback.reset()
			clock.restore()
		})

		context('Case 1: If setAccountAndGet return an error', function () {
			it('callback should receive an error as first parameter', function () {
				transfer.apply(trs_case_1, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equal('error1')
			})
		})

		context('Case 2: If mergeAccountAndGet return an error', function () {
			it('callback should receive an error as first parameter', function () {
				transfer.apply(trs_case_2, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equal('error2')
			})
		})

		context('Case 3: If everything is ok', function () {
			it('callback should not receive any error', function () {
				transfer.apply(trs_case_3, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(rounds.calc.called).to.be.true
				expect(callback.args[0][0]).to.equal('error2')
			})
		})
	})

	describe('undo()', function () {

		var transfer, accounts, rounds, system, trs_case_1, trs_case_2, trs_case_3, block, sender, callback, clock

		beforeEach(function () {
			transfer = new Transfer()
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
			trs_case_1 = {recipientId: false, amount: false}
			trs_case_2 = {recipientId: true, amount: false}
			trs_case_3 = {recipientId: true, amount: true}
			block = {id: 1, height: 2}
			accounts = {setAccountAndGet: function (data, cb) {
				if (data.address) {
					setImmediate(cb, null, data)
				} else {
					setImmediate(cb, 'error1')
				}
			}, mergeAccountAndGet: function (data, cb) {
				if (data.amount) {
					setImmediate(cb, null)
				} else {
					setImmediate(cb, 'error2')
				}
			}}
			rounds = {calc: function (height) {
				return height
			}}
			sinon.spy(accounts, 'setAccountAndGet')
			sinon.spy(accounts, 'mergeAccountAndGet')
			sinon.spy(rounds, 'calc')
			transfer.bind(accounts, rounds, system)
		})

		afterEach(function () {
			callback.reset()
			clock.restore()
		})

		context('Case 1: If setAccountAndGet return an error', function () {
			it('callback should receive an error as first parameter', function () {
				transfer.undo(trs_case_1, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equal('error1')
			})
		})

		context('Case 2: If mergeAccountAndGet return an error', function () {
			it('callback should receive an error as first parameter', function () {
				transfer.undo(trs_case_2, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equal('error2')
			})
		})

		context('Case 3: If everything is ok', function () {
			it('callback should not receive any error', function () {
				transfer.undo(trs_case_3, block, sender, callback)
				clock.runAll()
				expect(callback.called).to.be.true
				expect(rounds.calc.called).to.be.true
				expect(callback.args[0][0]).to.equal('error2')
			})
		})
	})

	describe('applyUnconfirmed()', function () {
		var transfer, trs, sender, callback, clock

		beforeEach(function () {
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
			transfer = new Transfer()
			transfer.applyUnconfirmed(trs, sender, callback)
		})

		afterEach(function () {
      clock.restore()
    })

		it('should call to callback', function () {
			clock.runAll()
			expect(callback.called).to.be.true
		})
	})

	describe('undoUnconfirmed()', function () {
		var transfer, trs, sender, callback, clock

		beforeEach(function () {
			callback = sinon.spy()
			clock = sinon.useFakeTimers()
			Transfer.__set__('setImmediate', setImmediate)
			transfer = new Transfer()
			transfer.undoUnconfirmed(trs, sender, callback)
		})

    afterEach(function () {
      clock.restore()
    })

		it('should call to callback', function () {
			clock.runAll()
			expect(callback.called).to.be.true
		})
	})

	describe('objectNormalize()', function () {
		var transfer, trs, trs2

		beforeEach(function () {
			trs = {blockId: 1, b: 2, c: 3}
			trs2 = {b: 2, c: 3}
			transfer = new Transfer()
		})

		it('should remove blockId property', function () {
			var result = transfer.objectNormalize(trs)
			expect(result).to.deep.equal(trs2)
		})
	})

	describe('dbRead()', function () {
		it('should return null', function () {
			var transfer = new Transfer()
			var result = transfer.dbRead({})
			expect(result).to.be.null
		})
	})

	describe('dbSave()', function () {
		it('should return null', function () {
			var transfer = new Transfer()
			var result = transfer.dbSave({})
			expect(result).to.be.null
		})
	})

	describe('ready()', function () {
		var transfer, trs, trs_case_3, trs_case_4, trs_case_5, sender, sender_case_1, sender_case_2

		beforeEach(function () {
			transfer = new Transfer()
			trs = {signatures: null}
			trs_case_3 = {signatures: [1, 2]}
			trs_case_4 = {signatures: [1]}
			trs_case_5 = {signatures: []}
			sender_case_1 = {multisignatures: []}
			sender_case_2 = {multisignatures: [1,2]}
			sender = {multisignatures: [1,2], multimin: 1}
		})

		context('Case 1: If sender.multisignatures is an empty Array', function () {
			it('should return true', function () {
				var result = transfer.ready(trs, sender_case_1)
				expect(result).to.be.true
			})
		})

		context('Case 2: If sender.multisignatures is an Array and has items but trs.signatures is not an Array', function () {
			it('should return false', function () {
				var result = transfer.ready(trs, sender_case_2)
				expect(result).to.be.false
			})
		})

		context('Case 3: If trs.signatures is greater than sender.multimin', function () {
			it('should return true', function () {
				var result = transfer.ready(trs_case_3, sender)
				expect(result).to.be.true
			})
		})

		context('Case 4: If trs.signatures is equal to sender.multimin', function () {
			it('should return true', function () {
				var result = transfer.ready(trs_case_4, sender)
				expect(result).to.be.true
			})
		})

		context('Case 5: If trs.signatures is less than sender.multimin', function () {
			it('should return false', function () {
				var result = transfer.ready(trs_case_5, sender)
				expect(result).to.be.false
			})
		})
	})
})
