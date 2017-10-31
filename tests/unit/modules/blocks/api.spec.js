var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../../..");

var sql = require(path.join(rootDir, "sql/blocks.js"));
var schema = require(path.join(rootDir, "schema/blocks.js"));
var constants = require(path.join(rootDir, "helpers/constants.js"));

var blocksApiModule = rewire(path.join(rootDir, "modules/blocks/api"));

describe("modules/blocks/api", function() {
    var __private = blocksApiModule.__get__("__private");

    var library = {
        logger: {
            trace: function() {},
            error: function() {}
        },
        db: {
            query : function() {}
        },
        schema: {
            validate : function() {}
        },
        dbSequence: {
            add : function() {}
        },
        logic: {
            block: {
                dbRead : function() {}
            }
        }
    };

    var API, callback;

    before(function() {
        sandbox = sinon.sandbox.create({
            injectInto: null,
            properties: ["spy", "stub", "clock"],
            useFakeTimers: true,
            useFakeServer: false
        });

        sandbox.stub(library.logger, "trace");
        sandbox.stub(library.logger, "error");
        sandbox.stub(library.db, "query");
        sandbox.stub(library.schema, "validate");
        sandbox.stub(library.dbSequence, "add");
        sandbox.stub(library.logic.block, "dbRead");

        callback = sandbox.stub();
    });

    beforeEach(function() {
        blocksApiModule.__set__("setImmediate", setImmediate);

        API = new blocksApiModule(
            library.logger,
            library.db,
            library.logic.block,
            library.schema,
            library.dbSequence
        );
    });

    afterEach(function() {
        sandbox.reset();
    });

    describe("constructor", function() {
        it("check properties", function() {
            var __library = blocksApiModule.__get__("library");

            expect(__library.logger).to.equal(library.logger);
            expect(__library.db).to.equal(library.db);
            expect(__library.schema).to.equal(library.schema);
            expect(__library.dbSequence).to.equal(library.dbSequence);
            expect(__library.logic.block).to.equal(library.logic.block);

            expect(library.logger.trace.calledOnce).to.be.true;
            expect(library.logger.trace.getCall(0).args.length).to.equal(1);
            expect(library.logger.trace.getCall(0).args[0]).to.equal("Blocks->API: Submodule initialized.");
        });
    });

    describe("__private.getById", function() {
        var id = "id";

        it("throws error", function(done) {
            var error = { stack : {} };

            library.db.query.rejects(error);

            __private.getById(id, callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(sql.getById);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal({ id : id });

            process.nextTick(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#getById error");

                done();
            });
        });

        it("not found", function(done) {
            library.db.query.resolves([]);

            __private.getById(id, callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(sql.getById);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal({ id : id });

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Block not found");

                done();
            });
        });

        it("success", function(done) {
            var row = {};
            var block = {};

            library.db.query.resolves([row]);
            library.logic.block.dbRead.returns(block);

            __private.getById(id, callback);

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(sql.getById);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal({ id : id });

            Promise.resolve().then(function() {
                sandbox.clock.tick();

                expect(library.logic.block.dbRead.calledOnce).to.be.true;
                expect(library.logic.block.dbRead.getCall(0).args.length).to.equal(1);
                expect(library.logic.block.dbRead.getCall(0).args[0]).to.equal(row);

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.be.null;
                expect(callback.getCall(0).args[1]).to.equal(block);

                done();
            });
        });
    });

    describe("__private.list", function() {
        var filter, where, params, order;

        var orderByStub, orderByTemp;

        before(function() {
            sandbox.stub(sql, "countList");
            sandbox.stub(sql, "list");

            orderByStub = sandbox.stub();
            orderByTemp = blocksApiModule.__get__("OrderBy");
            blocksApiModule.__set__("OrderBy", orderByStub);
        });

        beforeEach(function() {
            filter = {
                generatorPublicKey : "generatorPublicKey",
                numberOfTransactions : "numberOfTransactions",
                previousBlock : "previousBlock",
                height : 23,
                totalAmount : 24,
                totalFee : 25,
                reward : 26,
                limit : 90,
                offset : 10,
                orderBy : "height"
            };

            params = Object.assign({}, filter);
            delete params.orderBy;

            where = [
                '"b_generatorPublicKey"::bytea = ${generatorPublicKey}',
                '"b_numberOfTransactions" = ${numberOfTransactions}',
                '"b_previousBlock" = ${previousBlock}',
                '"b_height" = ${height}',
                '"b_totalAmount" = ${totalAmount}',
                '"b_totalFee" = ${totalFee}',
                '"b_reward" = ${reward}'
            ];

            order = {
                sortField : "sortField", 
                sortMethod : "sortMethod"
            };

            orderByStub.returns(order);
        });

        after(function() {
            blocksApiModule.__set__("OrderBy", orderByTemp);
        });

        it("invalid limit", function() {
            filter.limit = 200;

            __private.list(filter, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Invalid limit. Maximum is 100");
        });

        it("orderBy returns error", function() {
            var error = "error";
            order.error = error;

            __private.list(filter, callback);

            expect(orderByStub.calledOnce).to.be.true;
            expect(orderByStub.getCall(0).args.length).to.equal(2);
            expect(orderByStub.getCall(0).args[0]).to.equal(filter.orderBy);
            expect(orderByStub.getCall(0).args[1]).to.have.property("sortFields");
            expect(orderByStub.getCall(0).args[1]).to.have.property("fieldPrefix");
            expect(orderByStub.getCall(0).args[1]["sortFields"]).to.equal(sql.sortFields);
            expect(orderByStub.getCall(0).args[1]["fieldPrefix"]).to.equal("b_");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(order.error);
        });

        it("check default limit", function() {
            var listCount = {};

            delete filter.limit;
            params.limit = 100;

            library.db.query.rejects({});
            sql.countList.returns(listCount);

            __private.list(filter, callback);

            expect(sql.countList.calledOnce).to.be.true;
            expect(sql.countList.getCall(0).args.length).to.equal(1);
            expect(sql.countList.getCall(0).args[0]).to.deep.equal({ where : where });

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(listCount);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal(params);
        });

        it("check default offset", function() {
            var listCount = {};

            delete filter.offset;
            params.offset = 0;

            library.db.query.rejects({});
            sql.countList.returns(listCount);

            __private.list(filter, callback);

            expect(sql.countList.calledOnce).to.be.true;
            expect(sql.countList.getCall(0).args.length).to.equal(1);
            expect(sql.countList.getCall(0).args[0]).to.deep.equal({ where : where });

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(listCount);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal(params);
        });

        it("check default order", function() {
            var error = "error";
            order.error = error;

            delete filter.orderBy;

            __private.list(filter, callback);

            expect(orderByStub.calledOnce).to.be.true;
            expect(orderByStub.getCall(0).args.length).to.equal(2);
            expect(orderByStub.getCall(0).args[0]).to.equal("height:desc");
            expect(orderByStub.getCall(0).args[1]).to.have.property("sortFields");
            expect(orderByStub.getCall(0).args[1]).to.have.property("fieldPrefix");
            expect(orderByStub.getCall(0).args[1]["sortFields"]).to.equal(sql.sortFields);
            expect(orderByStub.getCall(0).args[1]["fieldPrefix"]).to.equal("b_");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(order.error);
        });

        it("countList rejects", function() {
            var listCount = {};
            var error = { stack : "error" };

            library.db.query.rejects({});
            sql.countList.returns(listCount);

            __private.list(filter, callback);

            expect(sql.countList.calledOnce).to.be.true;
            expect(sql.countList.getCall(0).args.length).to.equal(1);
            expect(sql.countList.getCall(0).args[0]).to.deep.equal({ where : where });

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(listCount);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal(params);

            process.nextTick(function() {
                expect(library.logger.error.calledOnce).to.be.true;
                expect(library.logger.error.getCall(0).args.length).to.equal(1);
                expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                sandbox.clock.tick();

                expect(callback.calledOnce);
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Blocks#list error");
            });
        });

        it("list rejects", function() {
            var count = 30;
            var listCountQuery = {};
            var listCountData = [{ count : count }];
            var listQuery = {};
            var error = { stack : "error" };

            sql.countList.returns(listCountQuery);
            sql.list.returns(listQuery);
            library.db.query.onCall(0).resolves(listCountData);
            library.db.query.onCall(1).rejects(error);

            __private.list(filter, callback);

            expect(sql.countList.calledOnce).to.be.true;
            expect(sql.countList.getCall(0).args.length).to.equal(1);
            expect(sql.countList.getCall(0).args[0]).to.deep.equal({ where : where });

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(listCountQuery);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal(params);

            Promise.resolve(function() {
                expect(sql.list.calledOnce).to.be.true;
                expect(sql.list.getCall(0).args.length).to.equal(1);
                expect(sql.list.getCall(0).args[0]).to.deep.equal({
                    where : where,
                    sortField : order.sortField,
                    sortMethod : order.sortMethod 
                });

                expect(library.db.query.calledTwice).to.be.true;
                expect(library.db.query.getCall(1).args.length).to.equal(2);
                expect(library.db.query.getCall(1).args[0]).to.equal(listQuery);
                expect(library.db.query.getCall(1).args[1]).to.deep.equal(params);

                process.nextTick(function() {
                    expect(library.logger.error.calledOnce).to.be.true;
                    expect(library.logger.error.getCall(0).args.length).to.equal(1);
                    expect(library.logger.error.getCall(0).args[0]).to.equal(error.stack);

                    sandbox.clock.tick();

                    expect(callback.calledOnce);
                    expect(callback.getCall(0).args.length).to.equal(1);
                    expect(callback.getCall(0).args[0]).to.equal("Blocks#list error");
                });
            });
        });

        it("success", function() {
            var count = 30;
            var listCountQuery = {};
            var listCountData = [{ count : count }];
            var listQuery = {};
            var row1 = {},
                row2 = {},
                rows = [row1, row2];
            var parsedRow1 = { parsed : true },
                parsedRow2 = { parsed : true },
                parsedRows = [parsedRow1, parsedRow2];

            sql.countList.returns(listCountQuery);
            sql.list.returns(listQuery);
            library.db.query.onCall(0).resolves(listCountData);
            library.db.query.onCall(1).resolves(rows);
            library.logic.block.dbRead.onCall(0).returns(parsedRow1);
            library.logic.block.dbRead.onCall(1).returns(parsedRow2);

            __private.list(filter, callback);

            expect(sql.countList.calledOnce).to.be.true;
            expect(sql.countList.getCall(0).args.length).to.equal(1);
            expect(sql.countList.getCall(0).args[0]).to.deep.equal({ where : where });

            expect(library.db.query.calledOnce).to.be.true;
            expect(library.db.query.getCall(0).args.length).to.equal(2);
            expect(library.db.query.getCall(0).args[0]).to.equal(listCountQuery);
            expect(library.db.query.getCall(0).args[1]).to.deep.equal(params);

            Promise.resolve(function() {
                expect(sql.list.calledOnce).to.be.true;
                expect(sql.list.getCall(0).args.length).to.equal(1);
                expect(sql.list.getCall(0).args[0]).to.deep.equal({
                    where : where,
                    sortField : order.sortField,
                    sortMethod : order.sortMethod 
                });

                expect(library.db.query.calledTwice).to.be.true;
                expect(library.db.query.getCall(1).args.length).to.equal(2);
                expect(library.db.query.getCall(1).args[0]).to.equal(listQuery);
                expect(library.db.query.getCall(1).args[1]).to.deep.equal(params);

                Promise.resolve(function() {
                    expect(library.logic.block.dbRead.calledTwice).to.be.true;
                    expect(library.logger.error.getCall(0).args.length).to.equal(1);
                    expect(library.logger.error.getCall(0).args[0]).to.equal(row1);
                    expect(library.logger.error.getCall(1).args.length).to.equal(1);
                    expect(library.logger.error.getCall(1).args[0]).to.equal(row2)

                    sandbox.clock.tick();

                    expect(callback.calledOnce);
                    expect(callback.getCall(0).args.length).to.equal(2);
                    expect(callback.getCall(0).args[0]).to.be.null;
                    expect(callback.getCall(0).args[1]).to.deep.equal({ blocks : parsedRows, count : count });
                });
            });
        });
    });

    describe("getBlock", function() {
        var request;

        beforeEach(function() {
            __private.loaded = true;

            request = {
                body : {
                    id : "id"
                }
            };

            sandbox.stub(__private, "getById");
        });

        afterEach(function() {
            __private.getById.restore();
        });

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getBlock(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("validation error", function() {
            var error = [{message : "error"}];

            library.schema.validate.callsArgWith(2, error);

            API.getBlock(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlock);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error[0].message);        
        });

        it("__private.getById error", function() {
            var error = "error";
            var block = "block";

            library.schema.validate.callsArgWith(2, null);
            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            __private.getById.callsArgWith(1, error, block);

            API.getBlock(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlock);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.dbSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.dbSequence.add.getCall(0).args[1]).to.equal(callback);

            expect(__private.getById.calledOnce).to.be.true;
            expect(__private.getById.getCall(0).args.length).to.equal(2);
            expect(__private.getById.getCall(0).args[0]).to.equal(request.body.id);
            expect(__private.getById.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Block not found");        
        });

        it("block not found", function() {
            var error = null;
            var block = null;

            library.schema.validate.callsArgWith(2, null);
            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            __private.getById.callsArgWith(1, error, block);

            API.getBlock(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlock);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.dbSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.dbSequence.add.getCall(0).args[1]).to.equal(callback);

            expect(__private.getById.calledOnce).to.be.true;
            expect(__private.getById.getCall(0).args.length).to.equal(2);
            expect(__private.getById.getCall(0).args[0]).to.equal(request.body.id);
            expect(__private.getById.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Block not found");        
        });

        it("success", function() {
            var error = null;
            var block = "block";

            library.schema.validate.callsArgWith(2, null);
            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            __private.getById.callsArgWith(1, error, block);

            API.getBlock(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlock);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.dbSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.dbSequence.add.getCall(0).args[1]).to.equal(callback);

            expect(__private.getById.calledOnce).to.be.true;
            expect(__private.getById.getCall(0).args.length).to.equal(2);
            expect(__private.getById.getCall(0).args[0]).to.equal(request.body.id);
            expect(__private.getById.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ block : block });
        });
    });

    describe("getBlocks", function() {
        var request;

        beforeEach(function() {
            __private.loaded = true;

            request = {
                body : {
                    id : "id"
                }
            };

            sandbox.stub(__private, "list");
        });

        afterEach(function() {
            __private.list.restore();
        });

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getBlocks(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("validation error", function() {
            var error = [{message : "error"}];

            library.schema.validate.callsArgWith(2, error);

            API.getBlocks(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlocks);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error[0].message);        
        });

        it("__private.list error", function() {
            var error = "error";
            var data = {
                count : "count",
                blocks : "block"
            };

            library.schema.validate.callsArgWith(2, null);
            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            __private.list.callsArgWith(1, error, data);

            API.getBlocks(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlocks);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.dbSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.dbSequence.add.getCall(0).args[1]).to.equal(callback);

            expect(__private.list.calledOnce).to.be.true;
            expect(__private.list.getCall(0).args.length).to.equal(2);
            expect(__private.list.getCall(0).args[0]).to.equal(request.body);
            expect(__private.list.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error);        
        });

        it("success", function() {
            var error = null;
            var data = {
                count : "count",
                blocks : "block"
            };

            library.schema.validate.callsArgWith(2, null);
            library.dbSequence.add.callsFake(function(foo, cb) {
                foo(cb);
            });
            __private.list.callsArgWith(1, error, data);

            API.getBlocks(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getBlocks);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            expect(library.dbSequence.add.calledOnce).to.be.true;
            expect(library.dbSequence.add.getCall(0).args.length).to.equal(2);
            expect(library.dbSequence.add.getCall(0).args[0]).to.be.a("function");
            expect(library.dbSequence.add.getCall(0).args[1]).to.equal(callback);

            expect(__private.list.calledOnce).to.be.true;
            expect(__private.list.getCall(0).args.length).to.equal(2);
            expect(__private.list.getCall(0).args[0]).to.equal(request.body);
            expect(__private.list.getCall(0).args[1]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ blocks : data.blocks, count : data.count });
        });
    });

    describe("getBroadhash", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getBroadhash(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                system : {
                    getBroadhash : sandbox.stub()
                }
            };
            var broadhash = "broadhash";

            modulesStub.system.getBroadhash.returns(broadhash);

            blocksApiModule.__set__("modules", modulesStub);

            __private.loaded = true;

            API.getBroadhash(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.system.getBroadhash.calledOnce).to.be.true;
            expect(modulesStub.system.getBroadhash.getCall(0).args.length).to.equal(0);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ broadhash : broadhash });

            blocksApiModule.__set__("modules", modulesTemp);
        });
    });

    describe("getEpoch", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getEpoch(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            __private.loaded = true;

            API.getEpoch(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ epoch : constants.epochTime });
        });
    });

    describe("getHeight", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getHeight(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub()
                    }
                }
            };
            var height = { height : "height" };

            modulesStub.blocks.lastBlock.get.returns(height);

            blocksApiModule.__set__("modules", modulesStub);

            __private.loaded = true;

            API.getHeight(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ height : height.height });

            blocksApiModule.__set__("modules", modulesTemp);
        });
    });

    describe("getFee", function() {
        var request = { body : { height : "height" } };

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getFee(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("validation error", function() {
            __private.loaded = true;

            var error = [{message : "error"}];

            library.schema.validate.callsArgWith(2, error);

            API.getFee(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getFee);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error[0].message);
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                system : {
                    getFees : sandbox.stub() 
                }
            };
            blocksApiModule.__set__("modules", modulesStub);

            __private.loaded = true;
            var data = { fees : { send : "send" } };
            var error = null;

            library.schema.validate.callsArgWith(2, error);
            modulesStub.system.getFees.returns(data);

            API.getFee(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getFee);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(error);
            expect(callback.getCall(0).args[1]).to.deep.equal({ fee : data.fee });

            blocksApiModule.__set__("modules", modulesTemp);
        });
    });

    describe("getFees", function() {
        var request = { body : { height : "height" } };

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getFees(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("validation error", function() {
            __private.loaded = true;

            var error = [{message : "error"}];

            library.schema.validate.callsArgWith(2, error);

            API.getFees(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getFees);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal(error[0].message);
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                system : {
                    getFees : sandbox.stub() 
                }
            };
            blocksApiModule.__set__("modules", modulesStub);

            __private.loaded = true;
            var data = {};
            var error = null;

            library.schema.validate.callsArgWith(2, error);
            modulesStub.system.getFees.returns(data);

            API.getFees(request, callback);

            expect(library.schema.validate.calledOnce).to.be.true;
            expect(library.schema.validate.getCall(0).args.length).to.equal(3);
            expect(library.schema.validate.getCall(0).args[0]).to.equal(request.body);
            expect(library.schema.validate.getCall(0).args[1]).to.equal(schema.getFees);
            expect(library.schema.validate.getCall(0).args[2]).to.be.a("function");

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(error);
            expect(callback.getCall(0).args[1]).to.deep.equal(data);

            blocksApiModule.__set__("modules", modulesTemp);
        });
    });

    describe("getNethash", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getNethash(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                system : {
                    getNethash : sandbox.stub() 
                }
            };
            var nethash = "nethash";

            modulesStub.system.getNethash.returns(nethash);

            blocksApiModule.__set__("modules", modulesStub);

            __private.loaded = true;

            API.getNethash(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.system.getNethash.calledOnce).to.be.true;
            expect(modulesStub.system.getNethash.getCall(0).args.length).to.equal(0);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ nethash : nethash });

            blocksApiModule.__set__("modules", modulesTemp);
        });
    });

    describe("getMilestone", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getMilestone(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub()
                    }
                }
            };
            var blockRewardTemp = __private.blockReward;
            var blockRewardStub = {
                calcMilestone : sandbox.stub()
            };
            var height = { height : "height" };
            var milestone = "milestone";

            blocksApiModule.__set__("modules", modulesStub);
            __private.blockReward = blockRewardStub;

            modulesStub.blocks.lastBlock.get.returns(height);
            __private.blockReward.calcMilestone.returns(milestone);

            __private.loaded = true;

            API.getMilestone(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);

            expect(__private.blockReward.calcMilestone.calledOnce).to.be.true;
            expect(__private.blockReward.calcMilestone.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcMilestone.getCall(0).args[0]).to.deep.equal(height.height);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ milestone : milestone });

            blocksApiModule.__set__("modules", modulesTemp);
            __private.blockReward = blockRewardTemp;
        });
    });

    describe("getReward", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getReward(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub()
                    }
                }
            };
            var blockRewardTemp = __private.blockReward;
            var blockRewardStub = {
                calcReward : sandbox.stub()
            };
            var height = { height : "height" };
            var reward = "reward";

            blocksApiModule.__set__("modules", modulesStub);
            __private.blockReward = blockRewardStub;

            modulesStub.blocks.lastBlock.get.returns(height);
            __private.blockReward.calcReward.returns(reward);

            __private.loaded = true;

            API.getReward(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);

            expect(__private.blockReward.calcReward.calledOnce).to.be.true;
            expect(__private.blockReward.calcReward.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcReward.getCall(0).args[0]).to.deep.equal(height.height);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ reward : reward });

            blocksApiModule.__set__("modules", modulesTemp);
            __private.blockReward = blockRewardTemp;
        });
    });

    describe("getSupply", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getSupply(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub()
                    }
                }
            };
            var blockRewardTemp = __private.blockReward;
            var blockRewardStub = {
                calcSupply : sandbox.stub()
            };
            var block = { height : "height" };
            var supply = "supply";

            blocksApiModule.__set__("modules", modulesStub);
            __private.blockReward = blockRewardStub;

            modulesStub.blocks.lastBlock.get.returns(block);
            __private.blockReward.calcSupply.returns(supply);

            __private.loaded = true;

            API.getSupply(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);

            expect(__private.blockReward.calcSupply.calledOnce).to.be.true;
            expect(__private.blockReward.calcSupply.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcSupply.getCall(0).args[0]).to.deep.equal(block.height);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({ supply : supply });

            blocksApiModule.__set__("modules", modulesTemp);
            __private.blockReward = blockRewardTemp;
        });
    });

    describe("getStatus", function() {
        var request = {};

        it("blockchain is not loaded", function() {
            __private.loaded = false;

            API.getStatus(request, callback);

            sandbox.clock.tick();

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(1);
            expect(callback.getCall(0).args[0]).to.equal("Blockchain is loading");
        });

        it("success", function() {
            var modulesTemp = blocksApiModule.__get__("modules");
            var modulesStub = {
                blocks : {
                    lastBlock : {
                        get : sandbox.stub()
                    }
                },
                system : {
                    getBroadhash : sandbox.stub(),
                    getFees : sandbox.stub(),
                    getNethash : sandbox.stub()
                }
            };
            var blockRewardTemp = __private.blockReward;
            var blockRewardStub = {
                calcMilestone : sandbox.stub(),
                calcReward : sandbox.stub(),
                calcSupply : sandbox.stub()
            };
            var block = { height : "height" };
            var broadhash = "broadhash";
            var fee = { fees : { send : "fee" } };
            var milestone = "milestone";
            var nethash = "nethash";
            var reward = "reward";
            var supply = "supply";

            blocksApiModule.__set__("modules", modulesStub);
            __private.blockReward = blockRewardStub;

            modulesStub.blocks.lastBlock.get.returns(block);
            modulesStub.system.getBroadhash.returns(broadhash);
            modulesStub.system.getFees.returns(fee);
            modulesStub.system.getNethash.returns(nethash);

            __private.blockReward.calcMilestone.returns(milestone);
            __private.blockReward.calcReward.returns(reward);
            __private.blockReward.calcSupply.returns(supply);

            __private.loaded = true;

            API.getStatus(request, callback);

            sandbox.clock.tick();

            expect(modulesStub.blocks.lastBlock.get.calledOnce).to.be.true;
            expect(modulesStub.blocks.lastBlock.get.getCall(0).args.length).to.equal(0);

            expect(modulesStub.system.getBroadhash.calledOnce).to.be.true;
            expect(modulesStub.system.getBroadhash.getCall(0).args.length).to.equal(0);

            expect(modulesStub.system.getFees.calledOnce).to.be.true;
            expect(modulesStub.system.getFees.getCall(0).args.length).to.equal(1);
            expect(modulesStub.system.getFees.getCall(0).args[0]).to.deep.equal(block.height);

            expect(__private.blockReward.calcMilestone.calledOnce).to.be.true;
            expect(__private.blockReward.calcMilestone.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcMilestone.getCall(0).args[0]).to.deep.equal(block.height);

            expect(__private.blockReward.calcReward.calledOnce).to.be.true;
            expect(__private.blockReward.calcReward.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcReward.getCall(0).args[0]).to.deep.equal(block.height);

            expect(__private.blockReward.calcSupply.calledOnce).to.be.true;
            expect(__private.blockReward.calcSupply.getCall(0).args.length).to.equal(1);
            expect(__private.blockReward.calcSupply.getCall(0).args[0]).to.deep.equal(block.height);

            expect(callback.calledOnce).to.be.true;
            expect(callback.getCall(0).args.length).to.equal(2);
            expect(callback.getCall(0).args[0]).to.equal(null);
            expect(callback.getCall(0).args[1]).to.deep.equal({
                broadhash : broadhash,
                epoch : constants.epochTime,
                height : block.height,
                fee : fee.fees.send,
                milestone : milestone,
                nethash : nethash,
                reward : reward,
                supply : supply
            });

            blocksApiModule.__set__("modules", modulesTemp);
            __private.blockReward = blockRewardTemp;
        });
    });

    describe("onBind", function() {
        it("success", function() {
            var scope = {
                blocks : "blocks",
                system : "system"
            };
            __private.loaded = false;

            API.onBind(scope);

            expect(blocksApiModule.__get__("modules")).to.deep.equal(scope);
            expect(__private.loaded).to.be.true;
        });
    });
});
