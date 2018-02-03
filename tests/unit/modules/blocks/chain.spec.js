var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../../..");

var chainModule = rewire(path.join(rootDir, "modules/blocks/chain"));
var sql = require(path.join(rootDir, "sql/blocks"));

describe("modules/blocks/chain", function() {
    var sandbox; 
    var library;

    var Chain; 
    var __library;
    var __private;
    var __libraryTemp;
    var __privateTemp;
    var callback; 


    before(function() {
        sandbox = sinon.sandbox.create({
            injectInto: null,
            properties: ["spy", "stub", "clock"],
            useFakeTimers: true,
            useFakeServer: false
        });

        library = {
            logger: {
                trace : sandbox.stub(),
                error : sandbox.stub(),
                debug : sandbox.stub(),
                warn  : sandbox.stub(),
                info : sandbox.stub()
            },
            db: {
                query : sandbox.stub(),
                tx : sandbox.stub(),
                none : sandbox.stub()
            },
            genesisblock: {
                block : {}
            },
            bus: {
                message : sandbox.stub()
            },
            balancesSequence: {
                add : sandbox.stub()
            },
            logic: {
                block: {
                    id : "id",
                    dbSave : sandbox.stub()
                },
                transaction: {
                    dbSave : sandbox.stub(),
                    afterSave : sandbox.stub(),
                    undoUnconfirmed : sandbox.stub()
                },
            },
        };
        callback = sandbox.stub();

        __private = chainModule.__get__("__private");
        __privateTemp = {};
        for(var prop in __private) {
            __privateTemp[prop] = __private[prop];
        }

        chainModule.__set__("setImmediate", setImmediate);
    });

    beforeEach(function() {
        chainModule.__set__("library", undefined);
        chainModule.__set__("__private", __privateTemp);
        chainModule.__set__("self", undefined);
        chainModule.__set__("modules", undefined);

        Chain = new chainModule(
            library.logger,
            library.logic.block,
            library.logic.transaction,
            library.db,
            library.genesisblock,
            library.bus,
            library.balancesSequence
        );
        __library = chainModule.__get__("library");
        __private = chainModule.__get__("__private");
    });

    afterEach(function() {
        sandbox.reset();
    });

    after(function() {
        sandbox.restore();
        chainModule.__set__("setImmediate", setImmediate);

        chainModule.__set__("library", undefined);
        chainModule.__set__("__private", __privateTemp);
        chainModule.__set__("self", undefined);
        chainModule.__set__("modules", undefined);
    });

    describe("constructor", function() {
        it("check library properties", function() {
            expect(__library.logger).to.equal(library.logger);
            expect(__library.db).to.equal(library.db);
            expect(__library.genesisBlock).to.equal(library.genesisBlock);
            expect(__library.bus).to.equal(library.bus);
            expect(__library.balansesSequence).to.equal(library.balansesSequence);
            expect(__library.logic.block).to.equal(library.logic.block);
            expect(__library.logic.transaction).to.equal(library.logic.transaction);
        });

        it("library.logger.trace called", function() {
            expect(library.logger.trace.calledOnce).to.be.true;
            expect(library.logger.trace.getCall(0))
        });
    });

    describe("saveGenesisBlock", function() {
        var error;
        var rows;

        beforeEach(function() {
            error = null;
            rows = [];

            library.db.query.resolves(rows);

            sandbox.stub(Chain, "saveBlock");
            Chain.saveBlock.callsArgWith(1, error);
        });

        after(function() {
            Chain.saveBlock.restore();
        });

        it("library.db.query called", function() {
            Chain.saveGenesisBlock(callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(sql.getGenesisBlockId);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal({id : library.genesisblock.block.id});
        });

        it("library.db.query rejects", function(done) {
            error = { stack : "error" };

            library.db.query.rejects(error);

            Chain.saveGenesisBlock(callback);

            Promise.resolve().then().then(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#saveGenesisBlock error");

                done();
            });
        });

        it("library.db.query returns blockId", function(done) {
            rows = [{ id : "id" }];

            library.db.query.resolves(rows);

            Chain.saveGenesisBlock(callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(0);

                done();
            });
        });

        it("saveBlock called", function(done) {
            Chain.saveGenesisBlock(callback);

            Promise.resolve().then(function() {
                expect(Chain.saveBlock.calledOnce).to.be.true;
                expect(Chain.saveBlock.getCall(0).args.length).to.equal(2);
                expect(Chain.saveBlock.getCall(0).args[0]).to.equal(library.genesisblock.block);
                expect(Chain.saveBlock.getCall(0).args[1]).to.be.a("function");

                done();
            });
        });

        it("saveBlock returns error", function(done) {
            error = "error";

            Chain.saveBlock.callsArgWith(1, error);

            Chain.saveGenesisBlock(callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal(error);

                done();
            });

        });
        
        it("saveBlock launch callback", function(done) {
            Chain.saveGenesisBlock(callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal(error);

                done();
            });
        });
    });

    describe("saveBlock", function() {
        var txStub;
        var block;
        var fakePromise;
        var fakeInserts;
        var fakeTemplate;
        var fakeTnone;

        var InsertsTemp;
        var InsertsStub;
        var __pPromiseTxTemp;
        var __pPromiseTxStub;
        var __pAfterSaveTemp;
        var __pAfterSaveStub;

        before(function() {
            txStub = {
                none : sandbox.stub(),
                batch : sandbox.stub()
            };
            block = {};
            fakePromise = {
                values : {}
            };
            fakeInserts = {
                template : sandbox.stub()
            };
            fakeTemplate = "template";
            fakeTnone = "tnone";

            InsertsTemp = chainModule.__get__("Inserts");
            InsertsStub = sandbox.stub();
            chainModule.__set__("Inserts", InsertsStub);

            __pPromiseTxTemp = __private.promiseTransactions;
            __pPromiseTxStub = sandbox.stub();
            __private.promiseTransactions = __pPromiseTxStub;

            __pAfterSaveTemp = __private.afterSave;
            __pAfterSaveStub = sandbox.stub();
            __private.afterSave = __pAfterSaveStub;
        });

        beforeEach(function() {
            library.db.tx.callsFake(function(foo) {
                foo(txStub);
                return Promise.resolve();
            });
            library.logic.block.dbSave.returns(fakePromise);
            InsertsStub.returns(fakeInserts);
            fakeInserts.template.returns(fakeTemplate);
            txStub.none.returns(fakeTnone);
            __pPromiseTxStub.returns(txStub);
            __pAfterSaveStub.resolves();
        });

        after(function() {
            chainModule.__set__("Inserts", InsertsTemp);
            __private.promiseTransactions = __pPromiseTxTemp;
            __private.afterSave = __pAfterSaveTemp;
        });

        it("library.db.tx called", function() {
            Chain.saveBlock(block, callback);

            expect(library.db.tx.calledOnce).to.be.true;
            expect(library.db.tx.getCall(0).args.length).to.equal(1);
            expect(library.db.tx.getCall(0).args[0]).to.be.a("function");
        });

        it("library.logic.block.dbSave called", function() {
            Chain.saveBlock(block, callback);

            expect(library.logic.block.dbSave.calledOnce).to.be.true;
            expect(library.logic.block.dbSave.getCall(0).args.length).to.equal(1);
            expect(library.logic.block.dbSave.getCall(0).args[0]).to.equal(block);
        });

        it("new Inserts called", function() {
            Chain.saveBlock(block, callback);

            expect(InsertsStub.calledOnce).to.be.true;
            expect(InsertsStub.calledWithNew()).to.be.true;
            expect(InsertsStub.getCall(0).args.length).to.equal(2);
            expect(InsertsStub.getCall(0).args[0]).to.equal(fakePromise);
            expect(InsertsStub.getCall(0).args[1]).to.equal(fakePromise.values);
        });

        it("inserts.template called", function() {
            Chain.saveBlock(block, callback);

            expect(fakeInserts.template.calledOnce).to.be.true;
            expect(fakeInserts.template.getCall(0).args.length).to.equal(0);
        });

        it("tx.none called", function() {
            Chain.saveBlock(block, callback);

            expect(txStub.none.calledOnce).to.be.true;
            expect(txStub.none.getCall(0).args.length).to.equal(2);
            expect(txStub.none.getCall(0).args[0]).to.equal(fakeTemplate);
            expect(txStub.none.getCall(0).args[1]).to.equal(fakePromise.values);
        });

        it("__private.promiseTransactions called", function() {
            Chain.saveBlock(block, callback);

            expect(__pPromiseTxStub.calledOnce).to.be.true;
            expect(__pPromiseTxStub.getCall(0).args.length).to.equal(3);
            expect(__pPromiseTxStub.getCall(0).args[0]).to.equal(txStub);
            expect(__pPromiseTxStub.getCall(0).args[1]).to.equal(block);
            expect(__pPromiseTxStub.getCall(0).args[2]).to.deep.equal([fakeTnone]);
        });

        it("tx.none called", function() {
            Chain.saveBlock(block, callback);

            expect(txStub.batch.calledOnce).to.be.true;
            expect(txStub.batch.getCall(0).args.length).to.equal(1);
            expect(txStub.batch.getCall(0).args[0]).to.deep.equal([fakeTnone]);
        });

        it("tx rejects", function(done) {
            var error = { stack : "error" };
            library.db.tx.callsFake(function(foo) {
                foo(txStub);
                return Promise.reject(error);
            });

            Chain.saveBlock(block, callback);

            Promise.resolve().then().then(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#saveBlock error");

                done();
            });
        });

        it("__private.afterSave called", function(done) {
            Chain.saveBlock(block, callback);

            Promise.resolve().then().then(function() {
                expect(__pAfterSaveStub.calledOnce).to.be.true;
                expect(__pAfterSaveStub.getCall(0).args.length).to.equal(2);
                expect(__pAfterSaveStub.getCall(0).args[0]).to.equal(block);
                expect(__pAfterSaveStub.getCall(0).args[1]).to.equal(callback);

                done();
            });
        });
    });

    describe("__private.afterSave", function() {
        var block;
        var firstTransaction;
        var secondTransaction;
        var afterSaveStub;
        
        before(function() {
            firstTransaction = {};
            secondTransaction = {};
        });

        beforeEach(function() {
            block = {
                transactions : [
                    firstTransaction,
                    secondTransaction
                ]
            };
            afterSaveStub = library.logic.transaction.afterSave;
            afterSaveStub.onCall(0).callsArgWith(1, null);
            afterSaveStub.onCall(1).callsArgWith(1, null);
        });

        it("library.bus.message called", function() {
            __private.afterSave(block, callback); 

            expect(library.bus.message.calledOnce).to.be.true;
            expect(library.bus.message.getCall(0).args.length).to.equal(2);
            expect(library.bus.message.getCall(0).args[0]).to.equal("transactionsSaved");
            expect(library.bus.message.getCall(0).args[1]).to.equal(block.transactions);
        });

        it("library.logic.transaction called twice", function() {
           __private.afterSave(block, callback); 

            expect(afterSaveStub.calledTwice).to.be.true;

            expect(afterSaveStub.getCall(0).args.length).to.equal(2);
            expect(afterSaveStub.getCall(0).args[0]).to.equal(firstTransaction);
            expect(afterSaveStub.getCall(0).args[1]).to.be.a("function");

            expect(afterSaveStub.getCall(1).args.length).to.equal(2);
            expect(afterSaveStub.getCall(1).args[0]).to.equal(secondTransaction);
            expect(afterSaveStub.getCall(1).args[1]).to.be.a("function");
        });

        it("first transaction error", function() {
            var error = "first error";

            afterSaveStub.onCall(0).callsArgWith(1, error);

           __private.afterSave(block, callback); 

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);
        });

        it("second transaction error", function() {
            var error = "second error";

            afterSaveStub.onCall(1).callsArgWith(1, error);

           __private.afterSave(block, callback); 

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);
        });

        it("callback called", function() {
           __private.afterSave(block, callback); 

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.be.null;
        });
    });

    describe("__private.promiseTransactions", function() {
        var block;
        var firstTransaction;
        var secondTransaction;
        var firstTxPromise;
        var secondTxPromise;
        var blockPromises;

        var txStub;
        var dbSaveStub;
        var fakeInsert;

        var InsertsRestore;
        var InsertsStub;

        before(function() {
            txStub = {
                none : sandbox.stub()
            };
            dbSaveStub = library.logic.transaction.dbSave;
            fakeInsert = {
                template : sandbox.stub()
            };
            InsertsStub = sandbox.stub();

            InsertsRestore = chainModule.__set__("Inserts", InsertsStub);
        });

        beforeEach(function() {
            firstTransaction = {};
            secondTransaction = {};
            firstTxPromise = {
                table : "first",
                values : ["11", "12"]
            };
            secondTxPromise = {
                table : "second",
                values : ["21", "22"]
            };
            block = {
                id : "id",
                transactions : [
                    firstTransaction,
                    secondTransaction
                ]
            };
            blockPromises = {};

            dbSaveStub.onCall(0).returns(firstTxPromise);
            dbSaveStub.onCall(1).returns(secondTxPromise);
            InsertsStub.returns(fakeInsert);
            fakeInsert.template.onCall(0).returns(1);
            fakeInsert.template.onCall(1).returns(2);
        });

        after(function() {
            InsertsRestore();
        });

        it("empty transactions", function() {
            block.transactions = [];

            var result = __private.promiseTransactions(txStub, block, blockPromises);
            expect(result).to.equal(txStub);
        });

        it("library.logic.transaction.dbSave called", function() {
            __private.promiseTransactions(txStub, block, blockPromises);

            expect(dbSaveStub.calledTwice).to.be.true;

            expect(dbSaveStub.getCall(0).args.length).to.equal(1);
            expect(dbSaveStub.getCall(0).args[0]).to.equal(firstTransaction);

            expect(dbSaveStub.getCall(1).args.length).to.equal(1);
            expect(dbSaveStub.getCall(1).args[0]).to.equal(secondTransaction);

        });

        it("library.logic.transaction.dbSave first fail", function() {
            dbSaveStub.onCall(0).returns(null);

            expect(__private.promiseTransactions.bind(null, txStub, block, blockPromises)).to.throw("Invalid promise");
        });

        it("library.logic.transaction.dbSave second fail", function() {
            dbSaveStub.onCall(1).returns(null);

            expect(__private.promiseTransactions.bind(null, txStub, block, blockPromises)).to.throw("Invalid promise");
        });

        it("inserts creation", function() {
            __private.promiseTransactions(txStub, block, blockPromises);

            expect(InsertsStub.calledTwice).to.be.true;
            expect(InsertsStub.calledWithNew()).to.be.true;

            expect(InsertsStub.getCall(0).args.length).to.equal(3);
            expect(InsertsStub.getCall(0).args[0]).to.equal(firstTxPromise);
            expect(InsertsStub.getCall(0).args[1]).to.deep.equal(firstTxPromise.values);
            expect(InsertsStub.getCall(0).args[2]).to.be.true;

            expect(InsertsStub.getCall(1).args.length).to.equal(3);
            expect(InsertsStub.getCall(1).args[0]).to.equal(secondTxPromise);
            expect(InsertsStub.getCall(1).args[1]).to.deep.equal(secondTxPromise.values);
            expect(InsertsStub.getCall(1).args[2]).to.be.true;

        });

        it("typeIterator first fail", function() {
            delete firstTxPromise.values;
            
            expect(__private.promiseTransactions.bind(null, txStub, block, blockPromises)).to.throw("Invalid promise");
        });

        it("typeIterator second fail", function() {
            delete secondTxPromise.values;

            expect(__private.promiseTransactions.bind(null, txStub, block, blockPromises)).to.throw("Invalid promise");
        });

        it("inserts.template called", function() {
            __private.promiseTransactions(txStub, block, blockPromises);

            expect(fakeInsert.template.calledTwice).to.be.true;
            expect(fakeInsert.template.getCall(0).args.length).to.equal(0);
            expect(fakeInsert.template.getCall(1).args.length).to.equal(0);
        });

        it("execute transaction", function() {
            __private.promiseTransactions(txStub, block, blockPromises);

            expect(txStub.none.calledTwice).to.be.true;

            expect(txStub.none.getCall(0).args.length).to.equal(2);
            expect(txStub.none.getCall(0).args[0]).to.equal(1);
            expect(txStub.none.getCall(0).args[1]).to.equal(fakeInsert);

            expect(txStub.none.getCall(1).args.length).to.equal(2);
            expect(txStub.none.getCall(1).args[0]).to.equal(2);
            expect(txStub.none.getCall(1).args[1]).to.equal(fakeInsert);
        });

        it("success", function() {
            var result = __private.promiseTransactions(txStub, block, blockPromises);
            expect(result).to.equal(txStub);
        });
    });

    describe("deleteBlock", function() {
        var blockId;

        beforeEach(function() {
            blockId = "blockId";

            library.db.none.resolves();
        });

        it("library.db.none called", function() {
            Chain.deleteBlock(blockId, callback);

            expect(library.db.none.calledOnce).to.be.true;
            expect(library.db.none.getCall(0).args.length).to.equal(2);
            expect(library.db.none.getCall(0).args[0]).to.equal(sql.deleteBlock);
            expect(library.db.none.getCall(0).args[1]).to.deep.equal({ id : blockId });
        });

        it("library.db.none rejects", function(done) {
            var error = { stack : "error" };

            library.db.none.rejects(error);

            Chain.deleteBlock(blockId, callback);

            process.nextTick(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#deleteBlock error"); 

                done();
            });
        });

        it("library.db.none resolves", function(done) {
            library.db.none.resolves();

            Chain.deleteBlock(blockId, callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(0);

                done();
            });
        });
    });

    describe("deleteAfterBlock", function() {
        var blockId;
        var result;

        beforeEach(function() {
            blockId = "blockId";
            result = {};

            library.db.query.resolves(result);
        });

        it("library.db.none called", function() {
            Chain.deleteAfterBlock(blockId, callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(sql.deleteAfterBlock);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal({ id : blockId });
        });

        it("library.db.none rejects", function(done) {
            var error = { stack : "error" };

            library.db.query.rejects(error);

            Chain.deleteAfterBlock(blockId, callback);

            process.nextTick(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#deleteAfterBlock error"); 

                done();
            });
        });

        it("library.db.none resolves", function(done) {
            Chain.deleteAfterBlock(blockId, callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.be.null;
                expect(callback.getCall(0).args[1]).to.equal(result);

                done();
            });
        });
    });

    describe("applyGenesisBlock", function() {
        var block;
        var tracker;
        var error;
        var sender;

        var modulesTemp; 
        var modulesStub;
        var applyTransactionTemp;
        var applyTransactionStub;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 
            modulesStub = {
                blocks : {
                    utils : {
                        getBlockProgressLogger : sandbox.stub()
                    },
                    lastBlock : {
                        set : sandbox.stub()
                    }
                },
                accounts : {
                    setAccountAndGet : sandbox.stub()
                },
                rounds : {
                    tick : sandbox.stub()
                }
            };

            applyTransactionTemp = __private.applyTransaction;
            applyTransactionStub = sandbox.stub();
            __private.applyTransaction = applyTransactionStub;

            sandbox.stub(process, "exit");
        });

        beforeEach(function() {
            chainModule.__set__("modules", modulesStub);
            block = {
                transactions : [
                    { type : 0, senderPublicKey : "first" },
                    { type : 3, senderPublicKey : "second" },
                    { type : 1, senderPublicKey : "third" },
                    { type : 3, senderPublicKey : "fourth" }
                ]
            };
            tracker = {
                applyNext : sandbox.stub()
            };
            error = null;
            sender = {};

            modulesStub.blocks.utils.getBlockProgressLogger.returns(tracker);
            modulesStub.accounts.setAccountAndGet.callsArgWith(1, error, sender);
            __private.applyTransaction.callsArgWith(3, error);
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);
            __private.applyTransaction = applyTransactionTemp;
            process.exit.restore();
        });

        it("modules.blocks.utils.getBlockProgressLogger called", function() {
            Chain.applyGenesisBlock(block, callback);

            expect(modulesStub.blocks.utils.getBlockProgressLogger.calledOnce).to.be.true;
            expect(modulesStub.blocks.utils.getBlockProgressLogger.getCall(0).args.length).to.equal(3);
            expect(modulesStub.blocks.utils.getBlockProgressLogger.getCall(0).args[0]).to.equal(block.transactions.length);
            expect(modulesStub.blocks.utils.getBlockProgressLogger.getCall(0).args[1]).to.equal(block.transactions.length / 100);
            expect(modulesStub.blocks.utils.getBlockProgressLogger.getCall(0).args[2]).to.equal("Genesis block loading");
        });

        it("modules.accounts.setAccountAndGet called", function() {
            Chain.applyGenesisBlock(block, callback);

            expect(modulesStub.accounts.setAccountAndGet.callCount).to.equal(block.transactions.length);
            block.transactions.forEach(function(transaction, index) {
                expect(modulesStub.accounts.setAccountAndGet.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.setAccountAndGet.getCall(index).args[0]).to.deep.equal({ publicKey : transaction.senderPublicKey });
            });
        });
        
        it("modules.blocks.lastBlock.set called", function() {
            Chain.applyGenesisBlock(block, callback);

            expect(modulesStub.blocks.lastBlock.set.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args.length).to.equal(1);
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args[0]).to.equal(block);
        });

        it("modules.blocks.lastBlock.set called", function() {
            Chain.applyGenesisBlock(block, callback);

            expect(modulesStub.blocks.lastBlock.set.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args.length).to.equal(1);
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args[0]).to.equal(block);
        });

        it("modules.rounds.tick called", function() {
            Chain.applyGenesisBlock(block, callback);

            expect(modulesStub.rounds.tick.calledOnce).to.be.true;
            expect(modulesStub.rounds.tick.getCall(0).args.length).to.equal(2);
            expect(modulesStub.rounds.tick.getCall(0).args[0]).to.equal(block);
            expect(modulesStub.rounds.tick.getCall(0).args[1]).to.equal(callback);
        });
    });

    describe("__private.applyTransaction", function() {
        var block;
        var transaction;
        var sender;
        var error;

        var modulesTemp; 
        var modulesStub;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 
            modulesStub = {
                transactions : {
                    applyUnconfirmed : sandbox.stub(),
                    apply : sandbox.stub()
                }
            };
        });

        beforeEach(function() {
            chainModule.__set__("modules", modulesStub);
            block = { value : "block" };
            transaction = { id : "transaction" };
            sender = { value : "sender" };
            error = null;

            modulesStub.transactions.applyUnconfirmed.callsArgWith(2, error);
            modulesStub.transactions.apply.callsArgWith(3, error);
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);
        });
   
        it("applyUnconfirmed called", function() {
            __private.applyTransaction(block, transaction, sender, callback);

            expect(modulesStub.transactions.applyUnconfirmed.calledOnce).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args.length).to.equal(3);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[0]).to.equal(transaction);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[1]).to.equal(sender);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[2]).to.be.a("function");
        });

        it("applyUnconfirmed error", function() {
            error = "error";
            modulesStub.transactions.applyUnconfirmed.callsArgWith(2, error);

            __private.applyTransaction(block, transaction, sender, callback);

            expect(modulesStub.transactions.applyUnconfirmed.calledOnce).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args.length).to.equal(3);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[0]).to.equal(transaction);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[1]).to.equal(sender);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.deep.equal({
                message : error,
                transaction : transaction,
                block : block
            });
        });

        it("apply called", function() {
            __private.applyTransaction(block, transaction, sender, callback);

            expect(modulesStub.transactions.apply.calledOnce).to.be.true;
            expect(modulesStub.transactions.apply.getCall(0).args.length).to.equal(4);
            expect(modulesStub.transactions.apply.getCall(0).args[0]).to.equal(transaction);
            expect(modulesStub.transactions.apply.getCall(0).args[1]).to.equal(block);
            expect(modulesStub.transactions.apply.getCall(0).args[2]).to.equal(sender);
            expect(modulesStub.transactions.apply.getCall(0).args[3]).to.be.a("function");
        });

        it("apply error", function() {
            error = "error";
            modulesStub.transactions.apply.callsArgWith(3, error);

            __private.applyTransaction(block, transaction, sender, callback);

            expect(modulesStub.transactions.apply.calledOnce).to.be.true;
            expect(modulesStub.transactions.apply.getCall(0).args.length).to.equal(4);
            expect(modulesStub.transactions.apply.getCall(0).args[0]).to.equal(transaction);
            expect(modulesStub.transactions.apply.getCall(0).args[1]).to.equal(block);
            expect(modulesStub.transactions.apply.getCall(0).args[2]).to.equal(sender);
            expect(modulesStub.transactions.apply.getCall(0).args[3]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.deep.equal({
                message : 'Failed to apply transaction: ' + transaction.id,
                transaction : transaction,
                block : block
            });
        });

        it("callback called", function() {
            __private.applyTransaction(block, transaction, sender, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(0);
        });
    });

    describe("applyBlock", function() {
        var block;
        var broadcast;
        var saveBlock;
        var error;

        var ids;
        var sender;

        var modulesTemp; 
        var modulesStub;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 
            modulesStub = {
                blocks : {
                    isActive : {
                        set : sandbox.stub()
                    },
                    lastBlock : {
                        set : sandbox.stub()
                    }
                },
                transactions : {
                    undoUnconfirmedList : sandbox.stub(),
                    applyUnconfirmed : sandbox.stub(),
                    applyUnconfirmedIds : sandbox.stub(),
                    apply : sandbox.stub(),
                    removeUnconfirmedTransaction : sandbox.stub()
                },
                accounts : {
                    setAccountAndGet : sandbox.stub(),
                    getAccount : sandbox.stub()
                },
                rounds : {
                    tick : sandbox.stub()
                }
            };

            sandbox.stub(process, "exit");
            sandbox.stub(process, "emit");
        });

        beforeEach(function() {
            chainModule.__set__("modules", modulesStub);
            block = {
                transactions : [
                    { id : "1", type : 0, senderPublicKey : "first" },
                    { id : "2", type : 3, senderPublicKey : "second" },
                    { id : "3", type : 1, senderPublicKey : "third" },
                    { id : "4", type : 3, senderPublicKey : "fourth" }
                ]
            };
            broadcast = "broadcast";
            saveBlock = true;
            error = null;
            ids = ["first","second","third"];
            sender = {};

            sandbox.stub(Chain, "saveBlock");

            modulesStub.transactions.undoUnconfirmedList.callsArgWith(0, error, ids);
            modulesStub.accounts.setAccountAndGet.callsArgWith(1, error, sender);
            modulesStub.transactions.applyUnconfirmed.callsArgWith(2, error);
            modulesStub.accounts.getAccount.callsArgWith(1, error, sender);
            library.logic.transaction.undoUnconfirmed.callsFake(function(tr, sender, cb) {
                setImmediate(cb);
            });
            modulesStub.transactions.apply.callsArgWith(3, error);
            Chain.saveBlock.callsArgWith(1, error);
            modulesStub.rounds.tick.callsArgWith(1, error);
            modulesStub.transactions.applyUnconfirmedIds.callsArgWith(1, error);
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);

            process.exit.restore();
            process.emit.restore();
        });
   
        it("modules.blocks.isActive.set called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            expect(modulesStub.blocks.isActive.set.calledOnce).to.be.true;
            expect(modulesStub.blocks.isActive.set.getCall(0).args.length).to.equal(1);
            expect(modulesStub.blocks.isActive.set.getCall(0).args[0]).to.be.true;
        });

        it("modules.transactions.undoUnconfirmedList called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            expect(modulesStub.transactions.undoUnconfirmedList.calledOnce).to.be.true;
            expect(modulesStub.transactions.undoUnconfirmedList.getCall(0).args.length).to.equal(1);
            expect(modulesStub.transactions.undoUnconfirmedList.getCall(0).args[0]).to.be.a("function");
        });

        it("modules.transactions.undoUnconfirmedList return error", function() {
            error = "error";
            modulesStub.transactions.undoUnconfirmedList.callsArgWith(0, error);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(2);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Failed to undo unconfirmed list");
            expect(library.logger.error.getCall(0).args[1]).to.equal(error);

            expect(process.exit.calledOnce).to.be.true;
            expect(process.exit.getCall(0).args.length).to.equal(1);
            expect(process.exit.getCall(0).args[0]).to.equal(0);
        });

        it("modules.accounts.setAccountAndGet called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                expect(modulesStub.accounts.setAccountAndGet.callCount).to.equal(index + 1);
                expect(modulesStub.accounts.setAccountAndGet.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.setAccountAndGet.getCall(index).args[0]).to.deep.equal({ publicKey : e.senderPublicKey });
                expect(modulesStub.accounts.setAccountAndGet.getCall(index).args[1]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("modules.transactions.applyUnconfirmed called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                expect(modulesStub.transactions.applyUnconfirmed.callCount).to.equal(index + 1);
                expect(modulesStub.transactions.applyUnconfirmed.getCall(index).args.length).to.equal(3);
                expect(modulesStub.transactions.applyUnconfirmed.getCall(index).args[0]).to.equal(e);
                expect(modulesStub.transactions.applyUnconfirmed.getCall(index).args[1]).to.equal(sender);
                expect(modulesStub.transactions.applyUnconfirmed.getCall(index).args[2]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("first modules.transactions.applyUnconfirmed return error", function() {
            error = "error";
            modulesStub.transactions.applyUnconfirmed.onCall(0).callsArgWith(2, error, sender);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            expect(modulesStub.transactions.applyUnconfirmed.calledOnce).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args.length).to.equal(3);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[0]).to.equal(block.transactions[0]);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[1]).to.equal(sender);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[2]).to.be.a("function");

            expect(library.logger.error.calledTwice).to.be.true;

            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal(['Failed to apply transaction:', block.transactions[0].id, '-', error].join(' '));

            expect(library.logger.error.getCall(1).args.length).to.equal(2);
            expect(library.logger.error.getCall(1).args[0]).to.equal('Transaction');
            expect(library.logger.error.getCall(1).args[1]).to.equal(block.transactions[0]);

            sandbox.clock.tick(1);

            block.transactions.forEach(function(e, index) {
                expect(modulesStub.accounts.getAccount.callCount).to.equal(index + 1);
                expect(modulesStub.accounts.getAccount.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.getAccount.getCall(index).args[0]).to.deep.equal({ publicKey : e.senderPublicKey });
                expect(modulesStub.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            //applyConfirmed 
            block.transactions.forEach(function() {
                sandbox.clock.tick(1);
            });

            //applyConfirmed eachSeries callback
            sandbox.clock.tick(1);

            //applyUnconfirmedIds callback
            sandbox.clock.tick(1);

            //callback
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
        });

        it("second modules.transactions.applyUnconfirmed return error", function() {
            error = "error";
            modulesStub.transactions.applyUnconfirmed.onCall(1).callsArgWith(2, error, sender);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            expect(modulesStub.transactions.applyUnconfirmed.calledOnce).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args.length).to.equal(3);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[0]).to.equal(block.transactions[0]);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[1]).to.equal(sender);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick(1);

            expect(modulesStub.transactions.applyUnconfirmed.calledTwice).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmed.getCall(1).args.length).to.equal(3);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(1).args[0]).to.equal(block.transactions[1]);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(1).args[1]).to.equal(sender);
            expect(modulesStub.transactions.applyUnconfirmed.getCall(1).args[2]).to.be.a("function");

            expect(library.logger.error.calledTwice).to.be.true;

            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal(['Failed to apply transaction:', block.transactions[1].id, '-', error].join(' '));

            expect(library.logger.error.getCall(1).args.length).to.equal(2);
            expect(library.logger.error.getCall(1).args[0]).to.equal('Transaction');
            expect(library.logger.error.getCall(1).args[1]).to.equal(block.transactions[1]);

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.accounts.getAccount.callCount).to.equal(index + 1);
                expect(modulesStub.accounts.getAccount.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.getAccount.getCall(index).args[0]).to.deep.equal({ publicKey : tr.senderPublicKey });
                expect(modulesStub.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                if(index == 0) {
                    expect(library.logic.transaction.undoUnconfirmed.calledOnce).to.be.true;
                    expect(library.logic.transaction.undoUnconfirmed.getCall(0).args.length).to.equal(3);
                    expect(library.logic.transaction.undoUnconfirmed.getCall(0).args[0]).to.equal(tr);
                    expect(library.logic.transaction.undoUnconfirmed.getCall(0).args[1]).to.equal(sender);
                    expect(library.logic.transaction.undoUnconfirmed.getCall(0).args[2]).to.be.a("function")

                }

                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            //applyConfirmed 
            block.transactions.forEach(function() {
                sandbox.clock.tick(1);
            });

            //applyConfirmed eachSeries callback
            sandbox.clock.tick(1);

            //applyUnconfirmedIds callback
            sandbox.clock.tick(1);

            //callback
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(null);
        });

        it("modules.accounts.getAccount called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.accounts.getAccount.callCount).to.equal(index + 1);
                expect(modulesStub.accounts.getAccount.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.getAccount.getCall(index).args[0]).to.deep.equal({ publicKey : tr.senderPublicKey });
                expect(modulesStub.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("modules.accounts.getAccount returns error", function() {
            error = "error";
            modulesStub.accounts.getAccount.onCall(1).callsArgWith(1, error, sender);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                if(index == 0 || index == 1){
                    expect(modulesStub.accounts.getAccount.callCount).to.equal(index + 1);
                    expect(modulesStub.accounts.getAccount.getCall(index).args.length).to.equal(2);
                    expect(modulesStub.accounts.getAccount.getCall(index).args[0]).to.deep.equal({ publicKey : tr.senderPublicKey });
                    expect(modulesStub.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                    sandbox.clock.tick(1);
                } 
            });

            expect(library.logger.error.calledTwice).to.be.true;

            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal(['Failed to apply transaction:', block.transactions[1].id, '-', error].join(' '));

            expect(library.logger.error.getCall(1).args.length).to.equal(2);
            expect(library.logger.error.getCall(1).args[0]).to.equal('Transaction');
            expect(library.logger.error.getCall(1).args[1]).to.equal(block.transactions[1]);

            expect(process.exit.calledOnce).to.be.true;
        })

        it("modules.transaction.apply called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.transactions.apply.callCount).to.equal(index + 1);
                expect(modulesStub.transactions.apply.getCall(index).args.length).to.equal(4);
                expect(modulesStub.transactions.apply.getCall(index).args[0]).to.equal(tr);
                expect(modulesStub.transactions.apply.getCall(index).args[1]).to.equal(block);
                expect(modulesStub.transactions.apply.getCall(index).args[2]).to.equal(sender);
                expect(modulesStub.transactions.apply.getCall(index).args[3]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("modules.transaction.apply returns error", function() {
            error = "error";
            modulesStub.transactions.apply.onCall(1).callsArgWith(3, error);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                if(index == 0 || index == 1){
                    expect(modulesStub.transactions.apply.callCount).to.equal(index + 1);
                    expect(modulesStub.transactions.apply.getCall(index).args.length).to.equal(4);
                    expect(modulesStub.transactions.apply.getCall(index).args[0]).to.equal(tr);
                    expect(modulesStub.transactions.apply.getCall(index).args[1]).to.equal(block);
                    expect(modulesStub.transactions.apply.getCall(index).args[2]).to.equal(sender);
                    expect(modulesStub.transactions.apply.getCall(index).args[3]).to.be.a("function");

                    sandbox.clock.tick(1);
                }
            });

            expect(library.logger.error.calledTwice).to.be.true;

            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal(['Failed to apply transaction:', block.transactions[1].id, '-', error].join(' '));

            expect(library.logger.error.getCall(1).args.length).to.equal(2);
            expect(library.logger.error.getCall(1).args[0]).to.equal('Transaction');
            expect(library.logger.error.getCall(1).args[1]).to.equal(block.transactions[1]);

            expect(process.exit.calledOnce).to.be.true;
        });

        it("module.transactions.removeUnconfirmedTransaction called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.transactions.removeUnconfirmedTransaction.callCount).to.equal(index + 1);
                expect(modulesStub.transactions.removeUnconfirmedTransaction.getCall(index).args.length).to.equal(1);
                expect(modulesStub.transactions.removeUnconfirmedTransaction.getCall(index).args[0]).to.equal(tr.id);

                sandbox.clock.tick(1);
            });
        });

        it("self.saveBlock called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            expect(Chain.saveBlock.calledOnce).to.be.true;
            expect(Chain.saveBlock.getCall(0).args.length).to.equal(2);
            expect(Chain.saveBlock.getCall(0).args[0]).to.equal(block);
            expect(Chain.saveBlock.getCall(0).args[1]).to.be.a("function");

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.getCall(0).args.length).to.equal(1);
            expect(library.logger.debug.getCall(0).args[0]).to.equal('Block applied correctly with ' + block.transactions.length + ' transactions');

            expect(library.bus.message.calledOnce).to.be.true;
            expect(library.bus.message.getCall(0).args.length).to.equal(3);
            expect(library.bus.message.getCall(0).args[0]).to.equal("newBlock");
            expect(library.bus.message.getCall(0).args[1]).to.equal(block);
            expect(library.bus.message.getCall(0).args[2]).to.equal(broadcast);

            expect(modulesStub.rounds.tick.calledOnce).to.be.true;
            expect(modulesStub.rounds.tick.getCall(0).args.length).to.equal(2);
            expect(modulesStub.rounds.tick.getCall(0).args[0]).to.equal(block);
            expect(modulesStub.rounds.tick.getCall(0).args[1]).to.be.a("function");
        });

        it("self.saveBlock returns error", function() {
            error = "error";
            Chain.saveBlock.callsArgWith(1, error);

            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            expect(Chain.saveBlock.calledOnce).to.be.true;
            expect(Chain.saveBlock.getCall(0).args.length).to.equal(2);
            expect(Chain.saveBlock.getCall(0).args[0]).to.equal(block);
            expect(Chain.saveBlock.getCall(0).args[1]).to.be.a("function");

            expect(library.logger.error.calledTwice).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal('Failed to save block...');
            expect(library.logger.error.getCall(1).args.length).to.equal(2);
            expect(library.logger.error.getCall(1).args[0]).to.equal('Block');
            expect(library.logger.error.getCall(1).args[1]).to.equal(block);

            expect(process.exit.calledOnce).to.be.true;
        });

        it("saveBlock = false", function() {
            saveBlock = false;
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            expect(library.bus.message.calledOnce).to.be.true;
            expect(library.bus.message.getCall(0).args.length).to.equal(3);
            expect(library.bus.message.getCall(0).args[0]).to.equal("newBlock");
            expect(library.bus.message.getCall(0).args[1]).to.equal(block);
            expect(library.bus.message.getCall(0).args[2]).to.equal(broadcast);

            expect(modulesStub.rounds.tick.calledOnce).to.be.true;
            expect(modulesStub.rounds.tick.getCall(0).args.length).to.equal(2);
            expect(modulesStub.rounds.tick.getCall(0).args[0]).to.equal(block);
            expect(modulesStub.rounds.tick.getCall(0).args[1]).to.be.a("function");
        });

        it("module.applyUnconfirmedIds called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            sandbox.clock.tick();

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            block.transactions.forEach(function(e, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            expect(modulesStub.transactions.applyUnconfirmedIds.calledOnce).to.be.true;
            expect(modulesStub.transactions.applyUnconfirmedIds.getCall(0).args.length).to.equal(2);
            expect(modulesStub.transactions.applyUnconfirmedIds.getCall(0).args[0]).to.equal(ids);
            expect(modulesStub.transactions.applyUnconfirmedIds.getCall(0).args[1]).to.be.a("function");
        });

        it("callback called", function() {
            Chain.applyBlock(block, broadcast, callback, saveBlock);

            //undoUnconfirmedList
            sandbox.clock.tick();

            //applyUnconfirmed eachSeries
            block.transactions.forEach(function() {
                sandbox.clock.tick(1);
            });

            //applyUnconfirmed eachSeries callback
            sandbox.clock.tick(1);

            //applyConfirmed eachSeries
            block.transactions.forEach(function() {
                sandbox.clock.tick(1);
            });

            //applyConfirmed eachSeries callback
            sandbox.clock.tick(1);

            //applyUnconfirmedIds callback
            sandbox.clock.tick(1);

            //callback
            sandbox.clock.tick(1);

            expect(modulesStub.blocks.isActive.set.calledTwice).to.be.true;
            expect(modulesStub.blocks.isActive.set.getCall(1).args.length).to.equal(1);
            expect(modulesStub.blocks.isActive.set.getCall(1).args[0]).to.equal(false);

            expect(callback.calledOnce).to.be.true;
        });
    });

    describe("__private.popLastBlock", function() {
        var block;
        var previousBlock;
        var sender;
        var error;

        var modulesTemp; 
        var modulesStub;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 
            modulesStub = {
                blocks : {
                    utils : {
                        loadBlocksPart : sandbox.stub()
                    }
                },
                accounts : {
                    getAccount : sandbox.stub()
                },
                transactions : {
                    undo : sandbox.stub(),
                    undoUnconfirmed : sandbox.stub()
                },
                rounds : {
                    backwardTick : sandbox.stub()
                }
            };

            sandbox.stub(process, "exit");
        });

        beforeEach(function() {
            chainModule.__set__("modules", modulesStub);

            block = {
                previousBlock : "45",
                transactions : [
                    { id : "1", type : 0, senderPublicKey : "first" },
                    { id : "2", type : 3, senderPublicKey : "second" },
                    { id : "3", type : 1, senderPublicKey : "third" },
                    { id : "4", type : 3, senderPublicKey : "fourth" }
                ]
            };
            previousBlock = [{}];
            sender = {};
            error = null;

            sandbox.stub(Chain, "deleteBlock");

            library.balancesSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            modulesStub.blocks.utils.loadBlocksPart.callsArgWith(1, error, previousBlock);
            modulesStub.accounts.getAccount.callsArgWith(1, error, sender);
            modulesStub.transactions.undo.callsArgWith(3, error);
            modulesStub.transactions.undoUnconfirmed.callsArgWith(1, error);
            modulesStub.rounds.backwardTick.callsArgWith(2, error);
            Chain.deleteBlock.callsArgWith(1, error);
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);

            process.exit.restore();
        });
   
        it("library.balancesSequence.add called", function() {
            __private.popLastBlock(block, callback);

            expect(library.balancesSequence.add.calledOnce).to.be.true;
            expect(library.balancesSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.balancesSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.balancesSequence.add.getCall(0).args[1]).to.equal(callback);
        });

        it("modules.blocks.utils.loadBlocksPart called", function() {
            __private.popLastBlock(block, callback);

            expect(modulesStub.blocks.utils.loadBlocksPart.calledOnce).to.be.true;
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args.length).to.equal(2);
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[0]).to.deep.equal({ id : block.previousBlock });
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[1]).to.be.a("function");
        });
        it("modules.blocks.utils.loadBlocksPart returns error", function() {
            error = "error";
            modulesStub.blocks.utils.loadBlocksPart.callsArgWith(1, error, previousBlock);

            __private.popLastBlock(block, callback);

            expect(modulesStub.blocks.utils.loadBlocksPart.calledOnce).to.be.true;
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args.length).to.equal(2);
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[0]).to.deep.equal({ id : block.previousBlock });
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);
        });

        it("modules.blocks.utils.loadBlocksPart returns empty previousBlock", function() {
            previousBlock = [];
            modulesStub.blocks.utils.loadBlocksPart.callsArgWith(1, error, previousBlock);

            __private.popLastBlock(block, callback);

            expect(modulesStub.blocks.utils.loadBlocksPart.calledOnce).to.be.true;
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args.length).to.equal(2);
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[0]).to.deep.equal({ id : block.previousBlock });
            expect(modulesStub.blocks.utils.loadBlocksPart.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal('previousBlock is null');
        });

        it("modules.accounts.getAccount called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.accounts.getAccount.callCount).to.equal(index + 1);
                expect(modulesStub.accounts.getAccount.getCall(index).args.length).to.equal(2);
                expect(modulesStub.accounts.getAccount.getCall(index).args[0]).to.deep.equal({publicKey : tr.senderPublicKey});
                expect(modulesStub.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });
        });

        it("modules.accounts.getAccount returns error", function() {
            error = "error";
            modulesStub.accounts.getAccount.callsArgWith(1, error, sender);

            __private.popLastBlock(block, callback);

            expect(modulesStub.accounts.getAccount.callCount).to.equal(1);
            expect(modulesStub.accounts.getAccount.getCall(0).args.length).to.equal(2);
            var publicKey = block.transactions[0].senderPublicKey;
            expect(modulesStub.accounts.getAccount.getCall(0).args[0]).to.deep.equal({publicKey : publicKey});
            expect(modulesStub.accounts.getAccount.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(2);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Failed to undo transactions")
            expect(library.logger.error.getCall(0).args[1]).to.equal(error);

            expect(process.exit.calledOnce).to.be.true;
        });

        it("modules.transactions.undo called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.transactions.undo.callCount).to.equal(index + 1);
                expect(modulesStub.transactions.undo.getCall(index).args.length).to.equal(4);
                expect(modulesStub.transactions.undo.getCall(index).args[0]).to.equal(tr);
                expect(modulesStub.transactions.undo.getCall(index).args[1]).to.equal(block);
                expect(modulesStub.transactions.undo.getCall(index).args[2]).to.equal(sender);
                expect(modulesStub.transactions.undo.getCall(index).args[3]).to.be.a("function");

                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });

        });

        it("modules.transactions.undoUnconfirmed called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                expect(modulesStub.transactions.undoUnconfirmed.callCount).to.equal(index + 1);
                expect(modulesStub.transactions.undoUnconfirmed.getCall(index).args.length).to.equal(2);
                expect(modulesStub.transactions.undoUnconfirmed.getCall(index).args[0]).to.equal(tr);
                expect(modulesStub.transactions.undoUnconfirmed.getCall(index).args[1]).to.be.a("function");

                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });
        });

        it("modules.rounds.backwardTick called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });
       
            expect(modulesStub.rounds.backwardTick.calledOnce).to.be.true;
            expect(modulesStub.rounds.backwardTick.getCall(0).args.length).to.equal(3);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[0]).to.equal(block);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[1]).to.equal(previousBlock[0]);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[2]).to.be.a("function");
        });

        it("modules.rounds.backwardTick returns error", function() {
            error = "error";
            modulesStub.rounds.backwardTick.callsArgWith(2, error);

            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });

            expect(modulesStub.rounds.backwardTick.calledOnce).to.be.true;
            expect(modulesStub.rounds.backwardTick.getCall(0).args.length).to.equal(3);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[0]).to.equal(block);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[1]).to.equal(previousBlock[0]);
            expect(modulesStub.rounds.backwardTick.getCall(0).args[2]).to.be.a("function");

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(2);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Failed to perform backwards tick");
            expect(library.logger.error.getCall(0).args[1]).to.equal(error);

            expect(process.exit.calledOnce).to.be.true;
        });

        it("Chain.deleteBlock called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });

            expect(Chain.deleteBlock.calledOnce).to.be.true;
            expect(Chain.deleteBlock.getCall(0).args.length).to.equal(2);
            expect(Chain.deleteBlock.getCall(0).args[0]).to.equal(block.id);
            expect(Chain.deleteBlock.getCall(0).args[1]).to.be.a("function");
        });

        it("Chain.deleteBlock return error", function() {
            error = "error";
            Chain.deleteBlock.callsArgWith(1, error);

            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                if(index) {
                    sandbox.clock.tick(1);
                } else {
                    sandbox.clock.tick(0);
                }
            });

            expect(Chain.deleteBlock.calledOnce).to.be.true;
            expect(Chain.deleteBlock.getCall(0).args.length).to.equal(2);
            expect(Chain.deleteBlock.getCall(0).args[0]).to.equal(block.id);
            expect(Chain.deleteBlock.getCall(0).args[1]).to.be.a("function");
       
            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(2);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Failed to delete block");
            expect(library.logger.error.getCall(0).args[1]).to.equal(error);

            expect(process.exit.calledOnce).to.be.true;
        });

        it("callback called", function() {
            __private.popLastBlock(block, callback);

            block.transactions.forEach(function(tr, index) {
                sandbox.clock.tick(1);
            });

            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.be.null;
            expect(callback.getCall(0).args[1]).to.equal(previousBlock[0]);
        });
    });

    describe("Chain.deleteLastBlock", function() {
        var lastBlock;
        var newLastBlock;
        var error;

        var modulesTemp; 
        var modulesStub;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 

            modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub(),
                        set : sandbox.stub()
                    }
                }
            };

            sandbox.stub(__private, "popLastBlock");
        });

        beforeEach(function() {
            chainModule.__set__("modules", modulesStub);

            lastBlock = {
                height : 100
            };
            newLastBlock = {};
            error = null;
            modulesStub.blocks.lastBlock.get.returns(lastBlock);
            __private.popLastBlock.callsArgWith(1, error, newLastBlock);
            modulesStub.blocks.lastBlock.set.returns(newLastBlock);
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);
        });

        it("modules.block.lastBlock.get called", function() {
            Chain.deleteLastBlock(callback);

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);
        });

        it("logger.debug.warn called", function() {
            Chain.deleteLastBlock(callback);

            expect(library.logger.warn.calledOnce).to.be.true;
            expect(library.logger.warn.getCall(0).args.length).to.equal(2);
            expect(library.logger.warn.getCall(0).args[0]).to.equal('Deleting last block');
            expect(library.logger.warn.getCall(0).args[1]).to.equal(lastBlock);
        });

        it("lastBlock.height == 1", function() {
            lastBlock.height = 1;

            Chain.deleteLastBlock(callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Cannot delete genesis block");
        });

        it("__private.popLastBlock called", function() {
            Chain.deleteLastBlock(callback);

            expect(__private.popLastBlock.calledOnce).to.be.true;
            expect(__private.popLastBlock.getCall(0).args.length).to.equal(2);
            expect(__private.popLastBlock.getCall(0).args[0]).to.equal(lastBlock);
            expect(__private.popLastBlock.getCall(0).args[1]).to.be.a("function");
       });

        it("__private.popLastBlock returns error", function() {
            error = "error";
            __private.popLastBlock.callsArgWith(1, error, newLastBlock);

            Chain.deleteLastBlock(callback);

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(2);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Error deleting last block");
            expect(library.logger.error.getCall(0).args[1]).to.equal(lastBlock);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(error);
            expect(callback.getCall(0).args[1]).to.equal(lastBlock);
        });

        it("modules.block.lastBlock.set called", function() {
            Chain.deleteLastBlock(callback);

            expect(modulesStub.blocks.lastBlock.set.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args.length).to.equal(1);
            expect(modulesStub.blocks.lastBlock.set.getCall(0).args[0]).to.equal(newLastBlock);
        });

        it("callback called", function() {
            Chain.deleteLastBlock(callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.be.null;
            expect(callback.getCall(0).args[1]).to.equal(newLastBlock);
        });
    });

    describe("Chain.recoverChain", function() {
        var newLastBlock;
        var error;

        beforeEach(function() {
            newLastBlock = {
                id : "id"
            };
            error = null;

            sandbox.stub(Chain, "deleteLastBlock");

            Chain.deleteLastBlock.callsArgWith(0, error, newLastBlock);
        });

        it("library.logger.warn called", function() {
            Chain.recoverChain(callback);

            expect(library.logger.warn.calledOnce).to.be.true;
            expect(library.logger.warn.getCall(0).args.length).to.equal(1);
            expect(library.logger.warn.getCall(0).args[0]).to.equal("Chain comparison failed, starting recovery");
        });

        it("Chain.deleteLastBlock called", function() {
            Chain.recoverChain(callback);

            expect(Chain.deleteLastBlock.calledOnce).to.be.true;
            expect(Chain.deleteLastBlock.getCall(0).args.length).to.equal(1);
            expect(Chain.deleteLastBlock.getCall(0).args[0]).to.be.a("function");
        });

        it("Chain.deleteLastBlock returns error", function() {
            error = "error";
            Chain.deleteLastBlock.callsArgWith(0, error, newLastBlock);

            Chain.recoverChain(callback);

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.getCall(0).args.length).to.equal(1);
            expect(library.logger.error.getCall(0).args[0]).to.equal("Recovery failed");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);
        });

        it("library.logger.info called", function() {
            Chain.recoverChain(callback);

            expect(library.logger.info.calledOnce).to.be.true;
            expect(library.logger.info.getCall(0).args.length).to.equal(2);
            expect(library.logger.info.getCall(0).args[0]).to.equal("Recovery complete, new last block");
            expect(library.logger.info.getCall(0).args[1]).to.equal(newLastBlock.id);
        });

        it("callback called", function() {
            Chain.recoverChain(callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);
        });
    });

    describe("Chain.onBind", function() {
        var scope;

        var modulesTemp; 
        var modulesStub;
        var loadedTemp;

        before(function() {
            modulesTemp = chainModule.__get__("modules"); 
            loadedTemp = __private.loaded;
        });

        beforeEach(function() {
            scope = {
                accounts : "accounts",
                blocks : "blocks",
                rounds : "rounds",
                transactions : "transactions"
            };

            chainModule.__set__("modules", modulesStub);
            __private.loaded = loadedTemp;
        });

        after(function() {
            chainModule.__set__("modules", modulesTemp);
            __private.loaded = loadedTemp;
        });

        it("library.logger.trace called", function() {
            Chain.onBind(scope);

            expect(library.logger.trace.calledTwice).to.be.true;
            expect(library.logger.trace.getCall(1).args.length).to.equal(1);
            expect(library.logger.trace.getCall(1).args[0]).to.equal("Blocks->Chain: Shared modules bind.");
        });

        it("check modules", function() {
            expect(chainModule.__get__("modules")).to.be.undefined;

            Chain.onBind(scope);

            expect(chainModule.__get__("modules")).to.deep.equal({
                accounts: scope.accounts,
                blocks: scope.blocks,
                rounds: scope.rounds,
                transactions: scope.transactions
            });
        });

        it("check __private.loaded", function() {
            expect(__private.loaded).to.be.undefined;

            Chain.onBind(scope);

            expect(__private.loaded).to.be.true;
        });
    });
});
