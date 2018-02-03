var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../../..");

var schema = require(path.join(rootDir, "schema/blocks"));
var sql = require(path.join(rootDir, "sql/blocks"));
var constants = require(path.join(rootDir, "helpers/constants"));
var processModule = rewire(path.join(rootDir, "modules/blocks/process"));

describe("modules/blocks/process", function() {
    var sandbox;

    var instance;
    var callback;
    var library;
    var modules;

    var __private;
    var __privateTemp;

    before(function() {
        sandbox = sinon.sandbox.create({
            injectInto: null,
            properties: ["spy", "stub", "clock"],
            useFakeTimers: true,
            useFakeServer: false
        });

        library = {
            logger : {
                err : sandbox.stub(),
                trace : sandbox.stub(),
                error : sandbox.stub(),
                debug : sandbox.stub(),
                info : sandbox.stub(),
                warn : sandbox.stub()
            },
            schema : {
                validate : sandbox.stub()
            },
            db : {
                query : sandbox.stub()
            },
            dbSequence : {
                add : sandbox.stub()
            },
            sequence : {
                add : sandbox.stub()
            },
            genesisblock : {
                block : {id:"id"}
            },
            logic : {
                block : {
                    create : sandbox.stub(),
                    objectNormalize : sandbox.stub()
                },
                peers : {
                    create : sandbox.stub()
                },
                transaction : {
                    ready : sandbox.stub(),
                    verify : sandbox.stub()
                }
            }
        };

        modules = {
            accounts : {
                getAccount : sandbox.stub()
            },
            blocks : {
                lastBlock : {
                    set : sandbox.stub(),
                    get : sandbox.stub()
                },
                lastReceipt : {
                    update : sandbox.stub()
                },
                isCleaning : {
                    get : sandbox.stub()
                },
                utils : {
                    getIdSequence : sandbox.stub(),
                    readDbRows : sandbox.stub()
                },
                chain : {
                    recoverChain : sandbox.stub(),
                    applyGenesisBlock : sandbox.stub(),
                    applyBlock : sandbox.stub(),
                    deleteLastBlock : sandbox.stub()
                },
                verify : {
                    verifyBlock : sandbox.stub(),
                    verifyReceipt : sandbox.stub(),
                    processBlock : sandbox.stub()
                }
            },
            delegates : {
                fork : sandbox.stub()
            },
            loader : {
                syncing : sandbox.stub()
            },
            rounds : {
                ticking : sandbox.stub(),
                calc : sandbox.stub()
            },
            transactions : {
                getUnconfirmedTransactionList : sandbox.stub()
            },
            transport : {
                getFromPeer : sandbox.stub(),
                poorConsensus : sandbox.stub()
            }
        };

        callback = sandbox.stub();

        __private = processModule.__get__("__private");
        __privateTemp = {};
        for(var prop in __private) {
            __privateTemp[prop] = __private[prop];
        }        

        processModule.__set__("setImmediate", setImmediate);
    });

    beforeEach(function() {
        __privateToSet = {};
        for(var prop in __privateTemp) {
            __privateToSet[prop] = __privateTemp[prop];
        }        

        processModule.__set__("__private", __privateToSet); 

        instance = new processModule(
            library.logger,
            library.logic.block,
            library.logic.peers,
            library.logic.transaction,
            library.schema,
            library.db,
            library.dbSequence,
            library.sequence,
            library.genesisblock
        );

        instance.onBind(modules);

        __private = processModule.__get__("__private");
    });

    afterEach(function() {
        sandbox.reset();
    });

    after(function() {
        sandbox.restore();
        processModule.__set__("__private", __privateTemp); 
        processModule.__set__("setImmediate", setImmediate);
    });

    describe("constructor", function() {
        it("check library properties", function() {
            var libraryOrigin = processModule.__get__("library");

            expect(libraryOrigin.logger).to.equal(library.logger);
            expect(libraryOrigin.schema).to.equal(library.schema);
            expect(libraryOrigin.db).to.equal(library.db);
            expect(libraryOrigin.dbSequence).to.equal(library.dbSequence);
            expect(libraryOrigin.sequence).to.equal(library.sequence);
            expect(libraryOrigin.genesisblock).to.equal(library.genesisblock);
            expect(libraryOrigin.logic.block).to.equal(library.logic.block);
            expect(libraryOrigin.logic.peers).to.equal(library.logic.peers);
            expect(libraryOrigin.logic.transaction).to.equal(library.logic.transaction);
        });

        it("library.logger.trace called", function() {
            expect(library.logger.trace.called).to.be.true;
            expect(library.logger.trace.firstCall.args.length).to.equal(1);
            expect(library.logger.trace.firstCall.args[0]).to.equal('Blocks->Process: Submodule initialized.');
        });
    });

    describe("onBind", function() {
        it("library.logger.trace called", function() {
            expect(library.logger.trace.called).to.be.true;
            expect(library.logger.trace.secondCall.args.length).to.equal(1);
            expect(library.logger.trace.secondCall.args[0]).to.equal('Blocks->Process: Shared modules bind.');
        });

        it("check modules properties", function() {
            var modulesOrigin = processModule.__get__("modules");

            expect(modulesOrigin.accounts).to.equal(modules.accounts);
            expect(modulesOrigin.blocks).to.equal(modules.blocks);
            expect(modulesOrigin.delegates).to.equal(modules.delegates);
            expect(modulesOrigin.loader).to.equal(modules.loader);
            expect(modulesOrigin.rounds).to.equal(modules.rounds);
            expect(modulesOrigin.transactions).to.equal(modules.transactions);
            expect(modulesOrigin.transport).to.equal(modules.transport);
        });

        it("__private.loaded should be true", function() {
            expect(__private.loaded).to.be.true;
        });
    });

    describe("getCommonBlock", function() {
        var peer;
        var height;
        var error;
        var res;
        var response;
        var rows;

        beforeEach(function() {
            peer = {
                string : "string"
            };
            height = {};
            error = null;
            res = {
                ids : []
            };
            response = {
                body : {
                    error : null,
                    common: {
                        id : "id",
                        previousBlock : {},
                        height : 123
                    }
                }
            };
            rows = [{count : 12},{count : 13}];

            modules.blocks.utils.getIdSequence.callsArgWith(1, error, res);
            modules.transport.getFromPeer.callsArgWith(2, error, response);
            library.schema.validate.callsArgWith(2, error);
            library.db.query.resolves(rows);
            modules.blocks.chain.recoverChain.callsArg(0);
        });

        it("modules.blocks.utils.getIdSequence called", function() {
            instance.getCommonBlock(peer, height, callback);

            expect(modules.blocks.utils.getIdSequence.calledOnce).to.be.true;
            expect(modules.blocks.utils.getIdSequence.firstCall.args.length).to.equal(2);
            expect(modules.blocks.utils.getIdSequence.firstCall.args[0]).to.equal(height);
            expect(modules.blocks.utils.getIdSequence.firstCall.args[1]).to.be.a("function");
        });

        it("modules.blocks.utils.getIdSequence returns error", function() {
            error = "error";

            modules.blocks.utils.getIdSequence.callsArgWith(1, error, res);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(error);
            expect(callback.firstCall.args[1]).to.equal(res);
        });

        it("modules.transport.getFromPeer called", function() {
            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();

            expect(modules.transport.getFromPeer.calledOnce).to.be.true;
            expect(modules.transport.getFromPeer.firstCall.args.length).to.equal(3);
            expect(modules.transport.getFromPeer.firstCall.args[0]).to.equal(peer);
            expect(modules.transport.getFromPeer.firstCall.args[1]).to.deep.equal({api:'/blocks/common?ids='+res.ids,method:'GET'});
            expect(modules.transport.getFromPeer.firstCall.args[2]).to.be.a("function");
        });

        it("modules.transport.getFromPeer returns error", function() {
            error = "error";

            modules.transport.getFromPeer.callsArgWith(2, error, response);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(error);
            expect(callback.firstCall.args[1]).to.equal(undefined);
        });

        it("modules.transport.getFromPeer comparsion failed; poorConsensus = false", function() {
            delete response.body.common;
            error = ['Chain comparison failed with peer:', peer.string, 'using ids:', res.ids].join(' ')

            modules.transport.poorConsensus.returns(false);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            expect(modules.transport.poorConsensus.calledOnce).to.be.true;
            expect(modules.transport.poorConsensus.firstCall.args.length).to.equal(0);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(error);
            expect(callback.firstCall.args[1]).to.equal(undefined);
        });

        it("modules.transport.getFromPeer comparsion failed; poorConsensus = true", function() {
            delete response.body.common;
            error = ['Chain comparison failed with peer:', peer.string, 'using ids:', res.ids].join(' ')

            modules.transport.poorConsensus.returns(true);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(modules.transport.poorConsensus.calledOnce).to.be.true;
            expect(modules.transport.poorConsensus.firstCall.args.length).to.equal(0);

            expect(modules.blocks.chain.recoverChain.calledOnce).to.be.true;
            expect(modules.blocks.chain.recoverChain.firstCall.args.length).to.equal(1);
            expect(modules.blocks.chain.recoverChain.firstCall.args[0]).to.equal(callback);

            expect(callback.calledOnce).to.be.true;
        });

        it("library.schema.validate called", function() {
            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.firstCall.args.length).to.equal(3);
            expect(library.schema.validate.firstCall.args[0]).to.equal(response.body.common);
            expect(library.schema.validate.firstCall.args[1]).to.equal(schema.getCommonBlock);
            expect(library.schema.validate.firstCall.args[2]).to.be.a("function");
        });

        it("library.db.query called", function() {
            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            expect(library.db.query.calledOnce);
            expect(library.db.query.firstCall.args.length).to.equal(2);
            expect(library.db.query.firstCall.args[0]).to.equal(sql.getCommonBlock(response.body.common.previousBlock));
            expect(library.db.query.firstCall.args[1]).to.deep.equal({
                id : response.body.common.id,
                previousBlock : response.body.common.previousBlock,
                height : response.body.common.height
            });
        });

        it("library.db.query rejects", function(done) {
            error = { stack : "error" };
            library.db.query.rejects(error);
            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            Promise.resolve().then().then(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.firstCall.args.length).to.equal(1);
                expect(library.logger.error.firstCall.args[0]).to.equal(error.stack);

                sandbox.clock.tick(1);

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal("Blocks#getCommonBlock error");
                expect(callback.firstCall.args[1]).to.equal(undefined);

                done();
            });
        });
        
        it("library.db.query returns empty array", function(done) {
            error = ['Chain comparison failed with peer:', peer.string, 'using block:', JSON.stringify(response.body.common)].join(' ');

            library.db.query.resolves([]);
            modules.transport.poorConsensus.returns(false);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            Promise.resolve().then().then(function() {
                sandbox.clock.tick(1);

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(error);
                expect(callback.firstCall.args[1]).to.equal(undefined);

                done();
            });
        });

        it("library.db.query returns array with 0 count", function(done) {
            rows = [{count : 0}]
            error = ['Chain comparison failed with peer:', peer.string, 'using block:', JSON.stringify(response.body.common)].join(' ');

            library.db.query.resolves([]);
            modules.transport.poorConsensus.returns(false);

            instance.getCommonBlock(peer, height, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            Promise.resolve().then().then(function() {
                sandbox.clock.tick(1);

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(error);
                expect(callback.firstCall.args[1]).to.equal(undefined);

                done();
            });
        });

        it("callback called", function(done) {
            instance.getCommonBlock(peer, height, callback);

            //modules.blocks.utils.getIdSequence callback
            sandbox.clock.tick();

            //modules.transport.getFromPeer callback
            sandbox.clock.tick(1);

            //library.schema.validate callback
            sandbox.clock.tick(1);

            //library.db.query promise
            Promise.resolve().then(function() {
                //library.db.query callback
                sandbox.clock.tick(1);

                //to call callback
                sandbox.clock.tick(1);

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(error);
                expect(callback.firstCall.args[1]).to.equal(response.body.common);

                done();
            });
        });
    });

    describe("loadBlocksOffset", function() {
        var limit; 
        var offset;
        var verify;

        var rows;
        var blocks;
        var check;
        var lastBlock;

        beforeEach(function() {
            limit = 10;
            offset = 20;
            verify = false;

            rows = [{},{}];
            blocks = [{id:1},{id:2}];
            check = { verified : true };
            lastBlock = {};

            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            library.db.query.resolves(rows);
            modules.blocks.utils.readDbRows.returns(blocks);
            modules.blocks.isCleaning.get.returns(false);
            modules.blocks.verify.verifyBlock.returns(check);
            modules.blocks.chain.applyGenesisBlock.callsArg(1);
            modules.blocks.chain.applyBlock.callsArg(2);
            modules.blocks.lastBlock.get.returns(lastBlock);
        });

        it("library.logger.debug called", function() {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.firstCall.args.length).to.equal(2);
            expect(library.logger.debug.firstCall.args[0]).to.equal("Loading blocks offset");
            expect(library.logger.debug.firstCall.args[1]).to.deep.equal({limit: limit, offset: offset, verify: verify});
        });

        it("library.dbSequence.add called", function() {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.firstCall.args.length).to.equal(2);
            expect(library.dbSequence.add.firstCall.args[0]).to.be.a("function");
            expect(library.dbSequence.add.firstCall.args[1]).to.equal(callback);
        });

        it("library.db.query called", function() {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.firstCall.args.length).to.equal(2);
            expect(library.db.query.firstCall.args[0]).to.equal(sql.loadBlocksOffset);
            expect(library.db.query.firstCall.args[1]).to.deep.equal({limit:limit+offset,offset:offset});
        });

        it("library.db.query throws error", function(done) {
            error = {stack : "error"};

            library.db.query.rejects(error);

            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then().then(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.firstCall.args.length).to.equal(1);
                expect(library.logger.error.firstCall.args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(1);
                expect(callback.firstCall.args[0]).to.equal("Blocks#loadBlocksOffset error");

                done();
            });

        });

        it("modules.blocks.utils.readDbRows called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.utils.readDbRows.calledOnce).to.be.true;
                expect(modules.blocks.utils.readDbRows.firstCall.args.length).to.equal(1);
                expect(modules.blocks.utils.readDbRows.firstCall.args[0]).to.equal(rows);
                done();
            });
        });

        it("modules.blocks.isCleaning.get called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.isCleaning.get.callCount).to.equal(rows.length);
                rows.forEach(function(row, index) {
                    expect(modules.blocks.isCleaning.get.getCall(index).args.length).to.equal(0);
                });
                done();
            });
        });

        it("modules.blocks.isCleaning.get returns true", function(done) {
            modules.blocks.isCleaning.get.returns(true);

            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.isCleaning.get.calledOnce).to.be.true;
                expect(library.logger.debug.calledOnce).to.be.true;

                sandbox.clock.tick();

                expect(modules.blocks.isCleaning.get.calledTwice).to.be.true;
                expect(library.logger.debug.calledOnce).to.be.true;
                
                sandbox.clock.tick(1);
                sandbox.clock.tick(1);

                expect(callback.calledOnce);
                done();
            });
        });

        it("library.logger.debug block called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(library.logger.debug.callCount).to.equal(1 + rows.length);
                rows.forEach(function(row, index) {
                    expect(library.logger.debug.getCall(1 + index).args.length).to.equal(2);
                    expect(library.logger.debug.getCall(1 + index).args[0]).to.equal("Processing block");
                    expect(library.logger.debug.getCall(1 + index).args[1]).to.equal(blocks[index]['id']);
                });
                done();
            });
        });

        it("modules.blocks.verify.verifyBlock called", function(done) {
            verify = true;
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.verify.verifyBlock.callCount).to.equal(rows.length);
                rows.forEach(function(row, index) {
                    expect(modules.blocks.verify.verifyBlock.getCall(index).args.length).to.equal(1);
                    expect(modules.blocks.verify.verifyBlock.getCall(index).args[0]).to.equal(blocks[index]);
                });
                done();
            });
        });

        it("modules.blocks.verify.verifyBlock returns false", function(done) {
            verify = true;
            check.verified = false;
            check.errors = [
                "first error",
                "second error"
            ];

            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.verify.verifyBlock.calledOnce).to.be.true;
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.firstCall.args.length).to.equal(2);
                expect(library.logger.error.firstCall.args[0]).to.equal(['Block', blocks[0].id, 'verification failed'].join(' '));
                expect(library.logger.error.firstCall.args[1]).to.equal(check.errors.join(', '));

                sandbox.clock.tick();
                sandbox.clock.tick(1);

                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(check.errors[0]);
                expect(callback.firstCall.args[1]).to.equal(lastBlock);

                done();
            });
        });

        it("modules.blocks.chain.applyGenesisBlock called", function(done) {
            blocks.forEach(function(block, index) {
                blocks[index]['id'] = library.genesisblock.block.id;
            });

            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.chain.applyGenesisBlock.callCount).to.equal(rows.length);
                rows.forEach(function(row, index) {
                    expect(modules.blocks.chain.applyGenesisBlock.getCall(index).args.length).to.equal(2);
                    expect(modules.blocks.chain.applyGenesisBlock.getCall(index).args[0]).to.equal(blocks[index]);
                    expect(modules.blocks.chain.applyGenesisBlock.getCall(index).args[1]).to.be.a("function")
                });
                done();
            });
        });

        it("modules.blocks.chain.applyBlock called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.chain.applyBlock.callCount).to.equal(rows.length);
                rows.forEach(function(row, index) {
                    expect(modules.blocks.chain.applyBlock.getCall(index).args.length).to.equal(4);
                    expect(modules.blocks.chain.applyBlock.getCall(index).args[0]).to.equal(blocks[index]);
                    expect(modules.blocks.chain.applyBlock.getCall(index).args[1]).to.be.false;
                    expect(modules.blocks.chain.applyBlock.getCall(index).args[2]).to.be.a("function");
                    expect(modules.blocks.chain.applyBlock.getCall(index).args[3]).to.be.false;
                });
                done();
            });
        });

        it("modules.blocks.lastBlock.set called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.lastBlock.set.callCount).to.equal(rows.length);
                blocks.reverse().forEach(function(block, index) {
                    expect(modules.blocks.lastBlock.set.getCall(index).args.length).to.equal(1);
                    expect(modules.blocks.lastBlock.set.getCall(index).args[0]).to.equal(block);
                });
                done();
            });
        });

        it("modules.blocks.lastBlock.get called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                expect(modules.blocks.lastBlock.get.calledOnce).to.be.true;
                expect(modules.blocks.lastBlock.get.firstCall.args.length).to.equal(0);
                done();
            });
        });


        it("callback called", function(done) {
            instance.loadBlocksOffset(limit, offset, verify, callback);

            Promise.resolve().then(function() {
                sandbox.clock.tick();
                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(null);
                expect(callback.firstCall.args[1]).to.equal(lastBlock);

                done();
            });
        });
    });

    describe("loadBlocksFromPeer", function() {
        var peer;
        var error;
        var lastValidBlocks;
        var normalizedPeer;
        var response;
        var report;
        var rows;

        beforeEach(function() {
            peer = {
                string : "string"
            };
            lastValidBlock = {
                id : "id"
            };
            normalizedPeer = {
                string : "string"
            };
            response = {
                body : {
                    blocks : [{},{}]
                },
                error : null
            };
            report = true;
            rows = [{
                id : 1,
                height : "height1"
            },{
                id : 2,
                height : "height2"
            }];

            modules.blocks.lastBlock.get.returns(lastValidBlock);
            library.logic.peers.create.returns(normalizedPeer);
            modules.transport.getFromPeer.callsArgWith(2, error, response);
            library.schema.validate.returns(report);
            modules.blocks.utils.readDbRows.returns(rows);
            modules.blocks.isCleaning.get.returns(false);
            modules.blocks.verify.processBlock.callsArgWith(2, error);
        });

        it("modules.blocks.lastBlock.get called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            expect(modules.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modules.blocks.lastBlock.get.firstCall.args.length).to.equal(0);
        });

        it("library.logic.peer.create called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            expect(library.logic.peers.create.calledOnce).to.be.true;
            expect(library.logic.peers.create.firstCall.args.length).to.equal(1);
            expect(library.logic.peers.create.firstCall.args[0]).to.equal(peer);
        });

        it("library.logger.info called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            expect(library.logger.info.calledOnce).to.be.true;
            expect(library.logger.info.firstCall.args.length).to.equal(1);
            expect(library.logger.info.firstCall.args[0]).to.equal('Loading blocks from: ' + normalizedPeer.string);
        });

        it("modules.transport.getFromPeer called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            expect(modules.transport.getFromPeer.calledOnce).to.be.true;
            expect(modules.transport.getFromPeer.firstCall.args.length).to.equal(3);
            expect(modules.transport.getFromPeer.firstCall.args[0]).to.equal(normalizedPeer);
            expect(modules.transport.getFromPeer.firstCall.args[1]).to.deep.equal({
                method: 'GET',
                api: '/blocks?lastBlockId=' + lastValidBlock.id
            });
            expect(modules.transport.getFromPeer.firstCall.args[2]).to.be.a("function");
        });

        it("modules.transport.getFromPeer return error", function() {
            response.body.error = "error";

            library.schema.validate.returns(false);

            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal("Error loading blocks: " + response.body.error);
            expect(callback.firstCall.args[1]).to.equal(lastValidBlock);
        });

        it("library.schema.validate called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.firstCall.args.length).to.equal(2);
            expect(library.schema.validate.firstCall.args[0]).to.equal(response.body.blocks);
            expect(library.schema.validate.firstCall.args[1]).to.equal(schema.loadBlocksFromPeer);
        });

        it("library.schema.validate returns false", function() {
            library.schema.validate.returns(false);

            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal("Error loading blocks: Received invalid blocks data");
            expect(callback.firstCall.args[1]).to.equal(lastValidBlock);
        });

        it("blocks empty", function() {
            response.body.blocks = [];

            instance.loadBlocksFromPeer(peer, callback);

            //getFromPeer callback
            sandbox.clock.tick();

            //validateBlocks callback
            sandbox.clock.tick(1);

            //processBlocks callback
            sandbox.clock.tick(1);

            expect(modules.blocks.verify.processBlock.called).to.be.false;

            //global callback
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;

        });

        it("modules.blocks.utils.readDbRows called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(modules.blocks.utils.readDbRows.calledOnce).to.be.true;
            expect(modules.blocks.utils.readDbRows.firstCall.args.length).to.equal(1);
            expect(modules.blocks.utils.readDbRows.firstCall.args[0]).to.equal(response.body.blocks);
        });

        it("modules.blocks.isCleaning.get called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(modules.blocks.isCleaning.get.callCount).to.equal(response.body.blocks.length);
            response.body.blocks.forEach(function(block, index) {
                expect(modules.blocks.isCleaning.get.getCall(index).args.length).to.equal(0);
            });
        });

        it("modules.blocks.verify.processBlock called multiple times", function() {
            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(modules.blocks.verify.processBlock.callCount).to.equal(rows.length);
            rows.forEach(function(block, index) {
                expect(modules.blocks.verify.processBlock.getCall(index).args.length).to.equal(4);
                expect(modules.blocks.verify.processBlock.getCall(index).args[0]).to.equal(block);
                expect(modules.blocks.verify.processBlock.getCall(index).args[1]).to.equal(false);
                expect(modules.blocks.verify.processBlock.getCall(index).args[2]).to.be.a("function");
                expect(modules.blocks.verify.processBlock.getCall(index).args[3]).to.equal(true);
            });
        });

        it("library.logger.info called multiple times", function() {
            instance.loadBlocksFromPeer(peer, callback);

            sandbox.clock.tick();
            sandbox.clock.tick(1);

            expect(library.logger.info.callCount).to.equal(1 + rows.length);
            rows.forEach(function(block, index) {
                expect(library.logger.info.getCall(1 + index).args.length).to.equal(2);
                expect(library.logger.info.getCall(1 + index).args[0]).to.equal(['Block', block.id, 'loaded from:', normalizedPeer.string].join(' '));
                expect(library.logger.info.getCall(1 + index).args[1]).to.equal('height: ' + block.height);
            });
        });

        it("callback called", function() {
            instance.loadBlocksFromPeer(peer, callback);

            //getFromPeer callback
            sandbox.clock.tick();

            //validateBlocks callback
            sandbox.clock.tick(1);

            //processBlocks callback
            sandbox.clock.tick(1);

            //global callback
            sandbox.clock.tick(1);

            expect(callback.calledOnce).to.be.true;
        });
    });

    describe("generateBlock", function() {
        var keypair;
        var timestamp;
        var transactions;
        var sender;
        var error;
        var block;
        var previousBlock;

        beforeEach(function() {
            keypair = "keypair";
            timestamp = "timestamp";
            transactions = [{
                senderPublicKey : "key1"
            },{
                senderPublicKey : "key2"
            }];
            sender = {};
            error = null;
            block = {};
            previsousBlock = { info : "info" };

            modules.transactions.getUnconfirmedTransactionList.returns(transactions);
            modules.accounts.getAccount.callsArgWith(1, error, sender);
            library.logic.transaction.ready.returns(true);
            library.logic.transaction.verify.callsArgWith(3, error);
            library.logic.block.create.returns(block);
            modules.blocks.lastBlock.get.returns(previousBlock);
            modules.blocks.verify.processBlock.callsArg(2);
        });

        it("modules.transactions.getUnconfirmedTransactionList called", function() {
            instance.generateBlock(keypair, timestamp, callback);

            expect(modules.transactions.getUnconfirmedTransactionList.calledOnce).to.be.true;
            expect(modules.transactions.getUnconfirmedTransactionList.firstCall.args.length).to.equal(2);
            expect(modules.transactions.getUnconfirmedTransactionList.firstCall.args[0]).to.equal(false);
            expect(modules.transactions.getUnconfirmedTransactionList.firstCall.args[1]).to.equal(constants.maxTxsPerBlock);
        });

        it("modules.accounts.getAccount called multiple times", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                expect(modules.accounts.getAccount.callCount).to.equal(index + 1);
                expect(modules.accounts.getAccount.getCall(index).args.length).to.equal(2);
                expect(modules.accounts.getAccount.getCall(index).args[0]).to.deep.equal({ publicKey : transaction.senderPublicKey });
                expect(modules.accounts.getAccount.getCall(index).args[1]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("modules.accounts.getAccount return error", function() {
            error = "error";

            modules.accounts.getAccount.callsArgWith(1, error, sender);

            instance.generateBlock(keypair, timestamp, callback);

            expect(library.logic.transaction.ready.called).to.be.false;

            sandbox.clock.tick();

            expect(callback.calledOnce);
        });

        it("library.logic.transaction.ready called multiple times", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                expect(library.logic.transaction.ready.callCount).to.equal(index + 1);
                expect(library.logic.transaction.ready.getCall(index).args.length).to.equal(2);
                expect(library.logic.transaction.ready.getCall(index).args[0]).to.equal(transaction);
                expect(library.logic.transaction.ready.getCall(index).args[1]).to.equal(sender);

                sandbox.clock.tick(1);
            });
        });

        it("library.logic.transaction.ready returns false", function() {
            library.logic.transaction.ready.returns(false);

            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                expect(library.logic.transaction.ready.callCount).to.equal(index + 1);

                expect(library.logic.transaction.verify.called).to.be.false;

                sandbox.clock.tick(1);
            });
        });

        it("library.logic.transaction.verify called multiple times", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                expect(library.logic.transaction.verify.callCount).to.equal(index + 1);
                expect(library.logic.transaction.verify.getCall(index).args.length).to.equal(4);
                expect(library.logic.transaction.verify.getCall(index).args[0]).to.equal(transaction);
                expect(library.logic.transaction.verify.getCall(index).args[1]).to.equal(sender);
                expect(library.logic.transaction.verify.getCall(index).args[2]).to.equal(null);
                expect(library.logic.transaction.verify.getCall(index).args[3]).to.be.a("function");

                sandbox.clock.tick(1);
            });
        });

        it("library.logic.transaction.verfiy returns error", function() {
            error = { stack : "error" };

            library.logic.transaction.verify.callsArgWith(3, error);

            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                expect(library.logger.err.callCount).to.equal(index + 1);
                expect(library.logger.err.getCall(index).args.length).to.equal(1);
                expect(library.logger.err.getCall(index).args[0]).to.equal(error.stack);

                sandbox.clock.tick(1);
            });
        });

        it("modules.blocks.lastBlock.get called", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                sandbox.clock.tick(1);
            });

            expect(modules.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modules.blocks.lastBlock.get.firstCall.args.length).to.equal(0);
        });

        it("library.logic.block.create called", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                sandbox.clock.tick(1);
            });

            expect(library.logic.block.create.calledOnce).to.be.true;
            expect(library.logic.block.create.firstCall.args.length).to.equal(1);
            expect(library.logic.block.create.firstCall.args[0]).to.deep.equal({
                keypair : keypair,
                timestamp : timestamp,
                previousBlock : previousBlock,
                transactions : transactions
            });
        });

        it("library.logic.block.create throws error", function() {
            error = { stack : "error" };

            library.logic.block.create.throws(error.stack);

            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                sandbox.clock.tick(1);
            });

            expect(library.logger.error.calledOnce).to.be.true;

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.be.instanceof(Error);
        });

        it("callback called", function() {
            instance.generateBlock(keypair, timestamp, callback);

            transactions.forEach(function(transaction, index) {
                sandbox.clock.tick(1);
            });

            expect(callback.calledOnce).to.be.true;
        });
    });

    describe("onReceiveBlock", function() {
        var slots;
        var slot;
        var roundsCount;

        var block;
        var lastBlock;

        before(function() {
            slots = processModule.__get__("slots");
            sandbox.stub(slots, "getSlotNumber");
        });

        beforeEach(function() {
            block = {
                id : "id",
                height : 124,
                previousBlock : "id",
                timestamp : 123123123,
                generatorPublicKey : "publicKey"
            };
            lastBlock = {
                id : "id",
                height : 123,
                previsousBlock : "not_same"
            };
            slot = {};
            roundsCount = {};

            library.sequence.add.callsFake(function(foo) {
                foo(callback);
            });
            modules.loader.syncing.returns(false);
            modules.rounds.ticking.returns(false);
            modules.rounds.calc.returns(roundsCount);
            modules.blocks.lastBlock.get.returns(lastBlock);
            sandbox.stub(__private, "receiveBlock");
            sandbox.stub(__private, "receiveForkOne");
            sandbox.stub(__private, "receiveForkFive");

            __private.receiveBlock.callsArg(1);
            __private.receiveForkOne.callsArg(2);
            __private.receiveForkFive.callsArg(2);
            slots.getSlotNumber.returns(slot);
        });

        after(function() {
            slots.getSlotNumber.restore();
        });

        it("library.sequence.add called", function() {
            instance.onReceiveBlock(block);

            expect(library.sequence.add.calledOnce).to.be.true;
            expect(library.sequence.add.firstCall.args.length).to.equal(1);
            expect(library.sequence.add.firstCall.args[0]).to.be.a("function");
        });

        it("__private.loaded = false", function() {
            __private.loaded = false;

            instance.onReceiveBlock(block);

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.firstCall.args.length).to.equal(2);
            expect(library.logger.debug.firstCall.args[0]).to.equal("Client not ready to receive block");
            expect(library.logger.debug.firstCall.args[1]).to.equal(block.id);

            expect(callback.called).to.be.false;
        });

        it("modules.loader.syncing called", function() {
            instance.onReceiveBlock(block);

            expect(modules.loader.syncing.calledOnce).to.be.true;
            expect(modules.loader.syncing.firstCall.args.length).to.equal(0);
        });

        it("modules.loader.syncing returns true", function() {
            modules.loader.syncing.returns(true);

            instance.onReceiveBlock(block);

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.firstCall.args.length).to.equal(2);
            expect(library.logger.debug.firstCall.args[0]).to.equal("Client not ready to receive block");
            expect(library.logger.debug.firstCall.args[1]).to.equal(block.id);

            expect(callback.called).to.be.false;
        });

        it("modules.rounds.ticking called", function() {
            instance.onReceiveBlock(block);

            expect(modules.rounds.ticking.calledOnce).to.be.true;
            expect(modules.rounds.ticking.firstCall.args.length).to.equal(0);
        });

        it("modules.rounds.ticking returns true", function() {
            modules.rounds.ticking.returns(true);

            instance.onReceiveBlock(block);

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.firstCall.args.length).to.equal(2);
            expect(library.logger.debug.firstCall.args[0]).to.equal("Client not ready to receive block");
            expect(library.logger.debug.firstCall.args[1]).to.equal(block.id);

            expect(callback.called).to.be.false;
        });

        it("__private.receiveBlock called", function() {
            instance.onReceiveBlock(block);

            expect(__private.receiveBlock.calledOnce).to.be.true;
            expect(__private.receiveBlock.firstCall.args.length).to.equal(2);
            expect(__private.receiveBlock.firstCall.args[0]).to.equal(block);
            expect(__private.receiveBlock.firstCall.args[1]).to.be.a("function");
        });

        it("__private.receiveForkOne called", function() {
            block.previousBlock = "inconrrect";

            instance.onReceiveBlock(block);

            expect(__private.receiveForkOne.calledOnce).to.be.true;
            expect(__private.receiveForkOne.firstCall.args.length).to.equal(3);
            expect(__private.receiveForkOne.firstCall.args[0]).to.equal(block);
            expect(__private.receiveForkOne.firstCall.args[1]).to.equal(lastBlock);
            expect(__private.receiveForkOne.firstCall.args[2]).to.be.a("function");

        });

        it("__private.receiveForkFive called", function() {
            lastBlock.previousBlock = block.previousBlock;
            lastBlock.height = block.height;
            lastBlock.id = "not_save";

            instance.onReceiveBlock(block);

            expect(__private.receiveForkFive.calledOnce).to.be.true;
            expect(__private.receiveForkFive.firstCall.args.length).to.equal(3);
            expect(__private.receiveForkFive.firstCall.args[0]).to.equal(block);
            expect(__private.receiveForkFive.firstCall.args[1]).to.equal(lastBlock);
            expect(__private.receiveForkFive.firstCall.args[2]).to.be.a("function");

        });

        it("block already processed", function() {
            lastBlock.height = 1;
            lastBlock.id = block.id;

            instance.onReceiveBlock(block);

            expect(library.logger.debug.calledOnce).to.be.true;
            expect(library.logger.debug.firstCall.args.length).to.equal(2);
            expect(library.logger.debug.firstCall.args[0]).to.equal("Block already processed");
            expect(library.logger.debug.firstCall.args[1]).to.equal(block.id);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
        });

        it("modules.rounds.calc called if discarded", function() {
            lastBlock.height = 1;
            lastBlock.id = "not_same";

            instance.onReceiveBlock(block);

            expect(modules.rounds.calc.calledOnce).to.be.true;
            expect(modules.rounds.calc.firstCall.args.length).to.equal(1);
            expect(modules.rounds.calc.firstCall.args[0]).to.equal(block.height);
        });

        it("slots.getSlotNumber called if discarded", function() {
            lastBlock.height = 1;
            lastBlock.id = "not_same";

            instance.onReceiveBlock(block);

            expect(slots.getSlotNumber.calledOnce).to.be.true;
            expect(slots.getSlotNumber.firstCall.args.length).to.equal(1);
            expect(slots.getSlotNumber.firstCall.args[0]).to.equal(block.timestamp);
        });

        it("Discarded block that does not match with current chain", function() {
            lastBlock.height = 1;
            lastBlock.id = "not_same";

            instance.onReceiveBlock(block);

            expect(library.logger.warn.calledOnce).to.be.true;
            expect(library.logger.warn.firstCall.args.length).to.equal(1);
            expect(library.logger.warn.firstCall.args[0]).to.equal([
                'Discarded block that does not match with current chain:', block.id,
                'height:', block.height,
                'round:',  roundsCount,
                'slot:', slot,
                'generator:', block.generatorPublicKey
            ].join(' '));

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;

        });

        it("callback called", function() {
            instance.onReceiveBlock(block);

            expect(callback.calledOnce).to.be.true;
        });
    });

    describe("__private.receiveBlock", function() {
        var slots;
        var slot;
        var roundsCount;
        var block;

        before(function() {
            slots = processModule.__get__("slots");
            sandbox.stub(slots, "getSlotNumber");
        });

        beforeEach(function() {
            slot = {};
            roundsCount = {};
            block = {
                id : "id",
                height : 123,
                timestamp : 123123123,
                reward : 120
            };

            slots.getSlotNumber.returns(slot);
            modules.rounds.calc.returns(roundsCount);
        });

        after(function() {
            slots.getSlotNumber.restore();
        });

        it("library.logger.info called", function() {
            __private.receiveBlock(block, callback);

            expect(library.logger.info.calledOnce).to.be.true;
            expect(library.logger.info.firstCall.args.length).to.equal(1);
            expect(library.logger.info.firstCall.args[0]).to.equal([
                'Received new block id:', block.id,
                'height:', block.height,
                'round:',  roundsCount,
                'slot:', slot,
                'reward:', block.reward
            ].join(' '));
        });

        it("modules.blocks.lastReceipt.update called", function() {
            __private.receiveBlock(block, callback);

            expect(modules.blocks.lastReceipt.update.calledOnce).to.be.true;
            expect(modules.blocks.lastReceipt.update.firstCall.args.length).to.equal(0);
        });

        it("modules.blocks.verify.processBlock called", function() {
            __private.receiveBlock(block, callback);

            expect(modules.blocks.verify.processBlock.calledOnce).to.be.true;
            expect(modules.blocks.verify.processBlock.firstCall.args.length).to.equal(4);
            expect(modules.blocks.verify.processBlock.firstCall.args[0]).to.equal(block)
            expect(modules.blocks.verify.processBlock.firstCall.args[1]).to.equal(true);
            expect(modules.blocks.verify.processBlock.firstCall.args[2]).to.equal(callback);
            expect(modules.blocks.verify.processBlock.firstCall.args[3]).to.equal(true);
        });
    });

    describe("__private.receiveForkOne called", function() {
        var block;
        var normalizedBlock;
        var lastBlock;
        var check;
        var error;

        beforeEach(function() {
            block = {
                timestamp : 99
            };
            lastBlock = {
                timestamp : 100
            };
            normalizedBlock = {
                id : "id"
            };
            check = {
                verified : true
            };
            error = null;

            library.logic.block.objectNormalize.returns(normalizedBlock);
            modules.blocks.verify.verifyReceipt.returns(check);
            modules.blocks.chain.deleteLastBlock.callsArg(0);
        });

        it("modules.delegates.fork called", function() {
        
        });

        it("last block stands; library.logger.info called", function() {
            block.timestamp = 101;

            __private.receiveForkOne(block, lastBlock, callback);

            expect(library.logger.info.calledOnce).to.be.true;
            expect(library.logger.info.firstCall.args.length).to.equal(1);
            expect(library.logger.info.firstCall.args[0]).to.equal("Last block stands");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(0);
        });

        it("last block and parent lost; library.logger.info called", function() {
            __private.receiveForkOne(block, lastBlock, callback);

            expect(library.logger.info.calledOnce).to.be.true;
            expect(library.logger.info.firstCall.args.length).to.equal(1);
            expect(library.logger.info.firstCall.args[0]).to.equal("Last block and parent loses");

            sandbox.clock.tick(3);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("library.logic.block.objectNormalize called", function() {
             __private.receiveForkOne(block, lastBlock, callback);

            expect(library.logic.block.objectNormalize.calledOnce).to.be.true;
            expect(library.logic.block.objectNormalize.firstCall.args.length).to.equal(1);
            expect(library.logic.block.objectNormalize.firstCall.args[0]).to.deep.equal(block);
        });

        it("library.logic.block.objectNormalize throws error", function() {
            error = "error";
            library.logic.block.objectNormalize.throws(error);

            __private.receiveForkOne(block, lastBlock, callback);

            sandbox.clock.tick(2);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.be.instanceof(Error);
        });

        it("modules.blocks.verify.verifyReceipt called", function() {
            __private.receiveForkOne(block, lastBlock, callback);

            sandbox.clock.tick(1);

            expect(modules.blocks.verify.verifyReceipt.calledOnce).to.be.true;
            expect(modules.blocks.verify.verifyReceipt.firstCall.args.length).to.equal(1);
            expect(modules.blocks.verify.verifyReceipt.firstCall.args[0]).to.equal(normalizedBlock);
        });

        it("modules.blocks.verify.verifyReceipt returns not verified check", function() {
            check.verified = false;
            check.errors = ["error"];

            __private.receiveForkOne(block, lastBlock, callback);

            sandbox.clock.tick(0);

            expect(library.logger.error.calledOnce).to.be.true;
            expect(library.logger.error.firstCall.args.length).to.equal(2);
            expect(library.logger.error.firstCall.args[0]).to.equal(['Block', normalizedBlock.id, 'verification failed'].join(' '));
            expect(library.logger.error.firstCall.args[1]).to.equal(check.errors.join(', '));

            sandbox.clock.tick(2);

            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(check.errors[0]);
        });

        it("modules.blocks.chain.deleteLastBlock called", function() {
            __private.receiveForkOne(block, lastBlock, callback);

            sandbox.clock.tick(2);

            expect(modules.blocks.chain.deleteLastBlock.calledTwice).to.be.true;
        });
    });
});
