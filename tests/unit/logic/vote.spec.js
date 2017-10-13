var chai = require('chai')
var assertArrays = require('chai-arrays')
chai.use(assertArrays)
var expect = chai.expect
var sinon = require('sinon')
var rewire = require('rewire')
var Vote = rewire('../../../logic/vote')
var zSchema = require('../../../helpers/z_schema')
var constants = require('../../../helpers/constants.js')
var crypto = require('crypto')

describe('logic/vote', function () {
	describe('when is imported', function () {
		it('should be a function', function () {
			expect(Vote).to.be.a('function')
		})
	})

	describe('when Vote is instantiated...', function () {

		var logger, schema, vote

		beforeEach(function () {
			logger = 1
			schema = 2
			vote = new Vote(logger, schema)
		})

		describe('logger and schema should be setted properly into library', function () {
			it('should be an object', function () {
				expect(Vote.__get__('library').logger).to.equals(logger)
				expect(Vote.__get__('library').schema).to.equals(schema)
			})
		})
	})

	describe('when we call to...', function () {

		var logger, schema, vote

		beforeEach(function () {
			logger = 1
			schema = 2
			vote = new Vote(logger, schema)
		})

		describe('bind()', function () {

			var delegates, rounds, system

			beforeEach(function () {
				delegates = 'a'
				rounds = 'b'
				system = 'c'
			})

			it('delegates, rounds and system should be setted properly into modules variable', function () {
				vote.bind(delegates, rounds, system)
				expect(Vote.__get__('modules').delegates).to.equals(delegates)
				expect(Vote.__get__('modules').rounds).to.equals(rounds)
				expect(Vote.__get__('modules').system).to.equals(system)
			})
		})

		describe('create()', function () {

			var data, trs

			beforeEach(function () {
				data = {sender: {address: 10}, votes: 20}
				trs = {recipientId: 0, asset: {votes: 0}}
			})

			it('transaction should be setted properly with data parameter', function () {
				var transaction = vote.create(data, trs)
				expect(transaction.recipientId).to.equals(data.sender.address)
				expect(transaction.asset.votes).to.equals(data.votes)
			})
		})

		describe('calculateFee()', function () {

			var trs, sender, height, delegates, rounds, system

			beforeEach(function () {
				height = 50
				system = {getFees: function (height) {
					return {fees: {vote: 100}}
				}}
			})

			it('should return vote\'s fee', function () {
				vote.bind(delegates, rounds, system)
				var fee = vote.calculateFee(trs, sender, height)
				expect(fee).to.equals(100)
			})
		})

		describe('verify()', function () {

			var clock, trs, sender, callback

			context('if trs.recipientId and trs.senderId are not equals', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {recipientId: 1, senderId: 2}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid recipient\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid recipient')
				})
			})

			context('if trs.asset is not true', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid transaction asset\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid transaction asset')
				})
			})

			context('if trs.asset.votes is not true', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: undefined}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid transaction asset\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid transaction asset')
				})
			})

			context('if trs.asset.votes is not an Array', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: 'foo'}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid votes. Must be an array\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid votes. Must be an array')
				})
			})

			context('if trs.asset.votes.length is not true', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: []}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid votes. Must not be empty\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid votes. Must not be empty')
				})
			})

			context('if trs.asset.votes.length is not true', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: []}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid votes. Must not be empty\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid votes. Must not be empty')
				})
			})

			context('if trs.asset.votes is greater than maxVotesPerTransaction', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: [1,2,3,4,5,6,7,8,9,10]}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Voting limit exceeded. Maximum is\' error', function () {
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.include('Voting limit exceeded')
				})
			})

			context('if vote has not a valid format', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: [123]}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid vote at index\' error', function () {

					clock.runAll()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.include('Invalid vote at index')
				})
			})

			context('if there are duplicate votes', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
					trs = {asset: {votes: ['+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', '+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9']}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Multiple votes for same delegate are not allowed\' error', function () {

					clock.runAll()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.include('Multiple votes for same delegate are not allowed')
				})
			})

			context('if everything is ok', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					Vote.__set__('self.checkConfirmedDelegates', function (trs, cb) {
						return setImmediate(cb)
					})
					callback = sinon.spy()
					trs = {asset: {votes: ['+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', '+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22']}}
					vote.verify(trs, sender, callback)
				})

				afterEach(function () {
					clock.restore()
				})

				it('should call to callback without errors', function () {

					clock.runAll()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals(undefined)
				})
			})
		})

		describe('verifyVote()', function () {

			var clock, callback

			context('if vote is not a string', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid vote type\' error', function () {
					vote.verifyVote(123, callback)
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid vote type')
				})
			})

			context('if vote has not a valid format', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid vote format\' error', function () {
					vote.verifyVote('+b94d27b993-d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', callback)
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid vote format')
				})
			})

			context('if vote length is not 65', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
				})

				afterEach(function () {
					clock.restore()
				})

				it('should return an \'Invalid vote length\' error', function () {
					vote.verifyVote('+b94d27b993d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9zz', callback)
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals('Invalid vote length')
				})
			})

			context('if vote is valid', function () {

				beforeEach(function () {
					clock = sinon.useFakeTimers()
					Vote.__set__('setImmediate', setImmediate)
					callback = sinon.spy()
				})

				afterEach(function () {
					clock.restore()
				})

				it('should call to callback without errors', function () {
					vote.verifyVote('+b94d27b993d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9z', callback)
					clock.tick()
					expect(callback.called).to.be.true
					expect(callback.args[0][0]).to.equals(undefined)
				})
			})

		})

		describe('checkConfirmedDelegates()', function () {

			var clock, trs, callback, delegates, rounds, system

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				trs = {senderPublicKey: 'foo', asset: {votes: []}}
				delegates = {}
				rounds = {}
				system = {}
				vote.bind(delegates, rounds, system)
				Vote.__set__({ modules: {
					delegates: {
						checkConfirmedDelegates: function (trs, votes, cb) {
							return setImmediate(cb)
						}
					}
				}
				})
				Vote.__set__('setImmediate', setImmediate)
				vote.checkConfirmedDelegates(trs, callback)
			})

			afterEach(function () {
				clock.restore()
			})

			it('should call to callback without errors', function () {
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equals(undefined)
			})
		})

		describe('checkUnconfirmedDelegates()', function () {
			var clock, trs, callback, delegates, rounds, system

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				Vote.__set__('setImmediate', setImmediate)
				trs = {senderPublicKey: 'foo', asset: {votes: []}}
				delegates = {}
				rounds = {}
				system = {}
				vote.bind(delegates, rounds, system)
				Vote.__set__({ modules: {
					delegates: {
						checkUnconfirmedDelegates: function (trs, votes, cb) {
							return setImmediate(cb)
						}
					}
				}
				})
				vote.checkUnconfirmedDelegates(trs, callback)
			})

			afterEach(function () {
				clock.restore()
			})

			it('should call to callback without errors', function () {
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][0]).to.equals(undefined)
			})
		})

		describe('process()', function () {

			var clock, trs, callback

			beforeEach(function () {
				trs = 1
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				Vote.__set__('setImmediate', setImmediate)
				vote.process(trs, null, callback)
			})

			it('should call to callback passing the same transaction parameter received', function () {
				clock.runAll()
				expect(callback.called).to.be.true
				expect(callback.args[0][1]).to.equals(trs)
			})

		})

		describe('getBytes()', function () {

			var trs, result, getBytes

			context('if the input data is wrong', function () {

				beforeEach(function () {
					trs = {asset: {votes: 123}}
					getBytes = function () {
						vote.getBytes(trs)
					}
				})

				it('should throws an error', function () {
					expect(getBytes).to.throw()
				})
			})

			context('if trs.asset.votes is undefined', function () {

				beforeEach(function () {
					trs = {asset: {votes: undefined}}
					result = vote.getBytes(trs)
				})

				it('should return null', function () {
					expect(result).to.equals(null)
				})
			})

			context('if everything is ok', function () {

				beforeEach(function () {
					trs = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22','+9f59d4260dcd848f71d17824f53df31f3dfb87542042590554419ff40542c55e']}}
					result = vote.getBytes(trs)
				})

				it('should return a Buffer object', function () {
					expect(result).to.be.an.instanceof(Buffer)
				})
			})
		})

		describe('apply()', function () {
			var clock, trs, block, sender, callback, scope, delegates, rounds, system

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				scope = { account: { merge: function (address, data, cb) { cb() } } }
				rounds = {calc: function (height) { return height }}
				trs = {asset: {votes: []}}
				sender = {address: 123}
				block = {id: 123, height: 123}
				Vote.__set__('setImmediate', setImmediate)
				Vote.__set__('self.checkConfirmedDelegates', function (trs, cb) {
					return setImmediate(cb)
				})
				Vote.__set__('self.scope', scope)
				vote.bind(delegates, rounds, system)
				vote.apply(trs, block, sender, callback)
			})

			afterEach(function () {
				clock.restore()
			})

			it('should call to callback', function () {

				clock.runAll()
				expect(callback.called).to.be.true
			})
		})

		describe('undo()', function () {
			var clock, trs, block, sender, callback, delegates, rounds, system, account, schema, logger

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				schema = new zSchema()
				vote = new Vote(logger, schema)
				account = { merge: function () {} }
				sinon.stub(account, 'merge').callsFake(function (address, data, cb) {
					cb()
				})
				Vote.__set__('self.scope', {account: account})
				rounds = {calc: function (height) { return height }}
				sender = {address: 123}
				block = {id: 123, height: 123}
				Vote.__set__('setImmediate', setImmediate)

				vote.bind(delegates, rounds, system)
			})

			afterEach(function () {
				clock.restore()
			})

			context('if trs.asset.votes is null', function () {

				beforeEach(function () {
					trs = {asset: {votes: null}}
					vote.undo(trs, block, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is empty', function () {

				beforeEach(function () {
					trs = {asset: {votes: []}}
					vote.undo(trs, block, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is undefined', function () {

				beforeEach(function () {
					trs = {asset: {votes: undefined}}
					vote.undo(trs, block, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes has not a valid format', function () {

				beforeEach(function () {
					trs = {asset: {votes: [1,2]}}
					vote.undo(trs, block, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is an Array and have items', function () {

				beforeEach(function () {
					trs = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22', '+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9']}}
					vote.undo(trs, block, sender, callback)
				})

				it('should call to scope.account.merge() and callback()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.true
					expect(callback.called).to.be.true
				})
			})
		})

		describe('applyUnconfirmed', function () {
			var clock, trs, sender, callback, scope

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				sender = {address: 123}
				scope = { account: { merge: function (address, data, cb) { cb() } } }
				trs = {asset: {votes: []}}
				Vote.__set__('setImmediate', setImmediate)
				Vote.__set__('self.checkUnconfirmedDelegates', function (trs, cb) {
					return setImmediate(cb)
				})
				Vote.__set__('self.scope', scope)
				vote.applyUnconfirmed(trs, sender, callback)
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
			var clock, trs, sender, callback, delegates, rounds, system, account, schema, logger

			beforeEach(function () {
				callback = sinon.spy()
				clock = sinon.useFakeTimers()
				schema = new zSchema()
				vote = new Vote(logger, schema)
				account = { merge: function () {} }
				sinon.stub(account, 'merge').callsFake(function (address, data, cb) {
					cb()
				})
				Vote.__set__('self.scope', {account: account})
				rounds = {calc: function (height) { return height }}
				sender = {address: 123}
				Vote.__set__('setImmediate', setImmediate)

				vote.bind(delegates, rounds, system)
			})

			afterEach(function () {
				clock.restore()
			})

			context('if trs.asset.votes is null', function () {

				beforeEach(function () {
					trs = {asset: {votes: null}}
					vote.undoUnconfirmed(trs, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is empty', function () {

				beforeEach(function () {
					trs = {asset: {votes: []}}
					vote.undoUnconfirmed(trs, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is undefined', function () {

				beforeEach(function () {
					trs = {asset: {votes: undefined}}
					vote.undoUnconfirmed(trs, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes has not a valid format', function () {

				beforeEach(function () {
					trs = {asset: {votes: [1,2]}}
					vote.undoUnconfirmed(trs, sender, callback)
				})

				it('should not call to scope.account.merge()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.false
					expect(callback.called).to.be.true
				})
			})

			context('if trs.asset.votes is an Array and have items', function () {

				beforeEach(function () {
					trs = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22', '+b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9']}}
					vote.undoUnconfirmed(trs, sender, callback)
				})

				it('should call to scope.account.merge() and callback()', function () {
					clock.runAll()
					var result = Vote.__get__('self.scope')
					expect(result.account.merge.called).to.be.true
					expect(callback.called).to.be.true
				})
			})
		})

		describe('objectNormalize()', function () {
      
			var trs_success, trs_fail_1, trs_fail_2, trs_fail_3, trs_fail_4, trs_fail_5, trs_fail_6, trs_fail_7, trs_fail_8, vote, logger, schema, execMethod
      
			beforeEach(function () {
				trs_success = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22', '-6d1103674f29502c873de14e48e9e432ec6cf6db76272c7b0dad186bb92c9a9a']}}
				trs_fail_1 = {asset: undefined}
				trs_fail_2 = {asset: {votes: undefined}}
				trs_fail_3 = {asset: {votes: null}}
				trs_fail_4 = {asset: {votes: []}}
				trs_fail_5 = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22', '+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22']}}
				trs_fail_6 = {asset: {votes: []}}
				for(var i = 0; i <= constants.maxVotesPerTransaction; i++){
					trs_fail_6.asset.votes.push('+' + crypto.createHash('sha256').update(i.toString(), 'utf8').digest('hex'))
				}
				trs_fail_7 = {asset: {votes: ['+37b6d3fc89fb418fa5e3799e760cc2b1733a567daebb08a531d3d7e8b24f2d22'], foo: {}}}
				trs_fail_8 = {asset: {votes: [123, 'abc']}}
				schema = new zSchema()
				vote = new Vote(logger, schema)
			})

			context('Fail 1: if trs.asset is undefined', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_1) }
					expect(execMethod).to.throw('Expected type object but found type undefined')
				})
			})

			context('Fail 2: if trs.asset.votes is undefined', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_2) }
					expect(execMethod).to.throw('Missing required property: votes')
				})
			})

			context('Fail 3: if trs.asset.votes is null', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_3) }
					expect(execMethod).to.throw('Expected type array but found type null')
				})
			})

			context('Fail 4: if trs.asset.votes is an empty Array', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_4) }
					expect(execMethod).to.throw('Array is too short')
				})
			})

			context('Fail 5: if trs.asset.votes has duplicates', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_5) }
					expect(execMethod).to.throw('Array items are not unique')
				})
			})

			context('Fail 6: if trs.asset.votes is greater than constants.maxVotesPerTransaction', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_6) }
					expect(execMethod).to.throw('Array is too long')
				})
			})

			context('Fail 7: if trs.asset has additional properties', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_7) }
					expect(execMethod).to.throw('Additional properties not allowed')
				})
			})

			context('Fail 8: if trs.asset.votes items has a wrong format', function () {
				it('should throw an exception', function () {
					execMethod = function () { vote.objectNormalize(trs_fail_8) }
					expect(execMethod).to.throw('String does not match pattern')
					expect(execMethod).to.throw('Expected type string but found type integer')
				})
			})

			context('if everything is ok', function () {
				it('should return the same transaction object', function () {
					var result = vote.objectNormalize(trs_success)
					expect(result).to.deep.equal(trs_success)
				})
			})
		})

		describe('dbRead()', function () {

			var raw_success, raw_fail_1, raw_fail_2, raw_fail_3, raw_fail_4, raw_fail_5

			beforeEach(function () {
				raw_fail_1 = {v_votes: undefined}
				raw_fail_2 = {v_votes: null}
				raw_fail_3 = {v_votes: false}
				raw_fail_4 = {v_votes: ''}
				raw_fail_5 = {v_votes: []}
				raw_success = {v_votes: '1,3,4'}
			})

			context('Fail 1: If v_votes is undefined', function () {
				it('should return null', function () {
					var result = vote.dbRead(raw_fail_1)
					expect(result).to.equals(null)
				})
			})

			context('Fail 2: If v_votes is null', function () {
				it('should return null', function () {
					var result = vote.dbRead(raw_fail_2)
					expect(result).to.equals(null)
				})
			})

			context('Fail 3: If v_votes is false', function () {
				it('should return null', function () {
					var result = vote.dbRead(raw_fail_3)
					expect(result).to.equals(null)
				})
			})

			context('Fail 4: If v_votes is an empty string', function () {
				it('should return null', function () {
					var result = vote.dbRead(raw_fail_4)
					expect(result).to.equals(null)
				})
			})

			context('Fail 5: If v_votes is not a string', function () {
				it('should return null', function () {
					var result = vote.dbRead(raw_fail_5)
					expect(result).to.equals(null)
				})
			})

			context('if everything is ok', function () {
				it('should return an object with votes as property in Array format', function () {
					var result = vote.dbRead(raw_success)
					expect(result).to.have.deep.property('votes')
					expect(result).to.deep.equal({ votes: [ '1', '3', '4' ] })
				})
			})


		})

		describe('dbSave()', function () {

			var trs

			beforeEach(function () {
				trs = {id: 123, asset: {votes: [1, 2, 3]}}
			})

			it('should return an object with a valid db schema', function () {
				var result = vote.dbSave(trs)
				expect(result).to.instanceof(Object)
				expect(result).to.deep.equal({table: 'votes', fields: ['votes', 'transactionId'], values: {votes: '1,2,3', transactionId: 123}})
			})

		})

		describe('ready()', function () {

			var trs, trs_case_4, trs_case_4_b, trs_case_5, sender_case_1, sender_case_2, sender_case_3, sender_case_4, sender_case_5
			beforeEach(function () {
				trs = {}
				trs_case_4 = {signatures: [1, 2, 3]}
				trs_case_4_b = {signatures: [1, 2]}
				trs_case_5 = {signatures: [1]}
				sender_case_1 = {multisignatures: undefined}
				sender_case_2 = {multisignatures: []}
				sender_case_3 = {multisignatures: [1, 2, 3]}
				sender_case_4 = {multisignatures: [1, 2, 3], multimin: 2}
				sender_case_5 = {multisignatures: [1, 2, 3], multimin: 2}
			})

			context('Case 1: If sender.multisignatures is not an Array', function () {
				it('should return true', function () {
					var result = vote.ready(trs, sender_case_1)
					expect(result).to.equals(true)
				})
			})

			context('Case 2: If sender.multisignatures is an empty Array', function () {
				it('should return true', function () {
					var result = vote.ready(trs, sender_case_2)
					expect(result).to.equals(true)
				})
			})

			context('Case 3: If trs.signatures is not an Array', function () {
				it('should return false', function () {
					var result = vote.ready(trs, sender_case_3)
					expect(result).to.equals(false)
				})
			})

			context('Case 4: If trs.signatures greater or equal than sender.multimin', function () {
				it('should return true', function () {
					var result = vote.ready(trs_case_4, sender_case_4)
					var result_b = vote.ready(trs_case_4_b, sender_case_4)
					expect(result).to.equals(true)
					expect(result_b).to.equals(true)
				})
			})

			context('Case 5: If trs.signatures less than sender.multimin', function () {
				it('should return false', function () {
					var result = vote.ready(trs_case_5, sender_case_5)
					expect(result).to.equals(false)
				})
			})
		})
	})
})
