var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");
var jsonSql = require("json-sql")();
jsonSql.setDialect("postgresql");

var rootDir = path.join(__dirname, "../../..");

var constants = require(path.join(rootDir, "helpers/constants")).default;
// var Account = rewire(path.join(rootDir, "logic/_account.js"));
var Account = rewire(path.join(rootDir, "logic/account.ts"));

var table = "mem_accounts";
var model = [
    {
        name: "username",
        type: "String",
        filter: {
            type: "string",
            case: "lower",
            maxLength: 20,
            minLength: 1
        },
        conv: String,
        immutable: true
    },
    {
        name: "isDelegate",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "u_isDelegate",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "secondSignature",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "u_secondSignature",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "u_username",
        type: "String",
        filter: {
            type: "string",
            case: "lower",
            maxLength: 20,
            minLength: 1
        },
        conv: String,
        immutable: true
    },
    {
        name: "address",
        type: "String",
        filter: {
            required: true,
            type: "string",
            case: "upper",
            minLength: 1,
            maxLength: 22
        },
        conv: String,
        immutable: true,
        expression: 'UPPER("address")'
    },
    {
        name: "publicKey",
        type: "Binary",
        filter: {
            type: "string",
            format: "publicKey"
        },
        conv: String,
        immutable: true,
        expression: "ENCODE(\"publicKey\", 'hex')"
    },
    {
        name: "secondPublicKey",
        type: "Binary",
        filter: {
            type: "string",
            format: "publicKey"
        },
        conv: String,
        immutable: true,
        expression: "ENCODE(\"secondPublicKey\", 'hex')"
    },
    {
        name: "balance",
        type: "BigInt",
        filter: {
            required: true,
            type: "integer",
            minimum: 0,
            maximum: constants.totalAmount
        },
        conv: Number,
        expression: '("balance")::bigint'
    },
    {
        name: "u_balance",
        type: "BigInt",
        filter: {
            required: true,
            type: "integer",
            minimum: 0,
            maximum: constants.totalAmount
        },
        conv: Number,
        expression: '("u_balance")::bigint'
    },
    {
        name: "vote",
        type: "BigInt",
        filter: {
            type: "integer"
        },
        conv: Number,
        expression: '("vote")::bigint'
    },
    {
        name: "rate",
        type: "BigInt",
        filter: {
            type: "integer"
        },
        conv: Number,
        expression: '("rate")::bigint'
    },
    {
        name: "delegates",
        type: "Text",
        filter: {
            type: "array",
            uniqueItems: true
        },
        conv: Array,
        expression:
        '(SELECT ARRAY_AGG("dependentId") FROM ' +
        table +
        '2delegates WHERE "accountId" = a."address")'
    },
    {
        name: "u_delegates",
        type: "Text",
        filter: {
            type: "array",
            uniqueItems: true
        },
        conv: Array,
        expression:
        '(SELECT ARRAY_AGG("dependentId") FROM ' +
        table +
        '2u_delegates WHERE "accountId" = a."address")'
    },
    {
        name: "multisignatures",
        type: "Text",
        filter: {
            type: "array",
            uniqueItems: true
        },
        conv: Array,
        expression:
        '(SELECT ARRAY_AGG("dependentId") FROM ' +
        table +
        '2multisignatures WHERE "accountId" = a."address")'
    },
    {
        name: "u_multisignatures",
        type: "Text",
        filter: {
            type: "array",
            uniqueItems: true
        },
        conv: Array,
        expression:
        '(SELECT ARRAY_AGG("dependentId") FROM ' +
        table +
        '2u_multisignatures WHERE "accountId" = a."address")'
    },
    {
        name: "multimin",
        type: "SmallInt",
        filter: {
            type: "integer",
            minimum: 0,
            maximum: 17
        },
        conv: Number
    },
    {
        name: "u_multimin",
        type: "SmallInt",
        filter: {
            type: "integer",
            minimum: 0,
            maximum: 17
        },
        conv: Number
    },
    {
        name: "multilifetime",
        type: "SmallInt",
        filter: {
            type: "integer",
            minimum: 1,
            maximum: 72
        },
        conv: Number
    },
    {
        name: "u_multilifetime",
        type: "SmallInt",
        filter: {
            type: "integer",
            minimum: 1,
            maximum: 72
        },
        conv: Number
    },
    {
        name: "blockId",
        type: "String",
        filter: {
            type: "string",
            minLength: 1,
            maxLength: 20
        },
        conv: String
    },
    {
        name: "nameexist",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "u_nameexist",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean
    },
    {
        name: "producedblocks",
        type: "Number",
        filter: {
            type: "integer",
            minimum: -1,
            maximum: 1
        },
        conv: Number
    },
    {
        name: "missedblocks",
        type: "Number",
        filter: {
            type: "integer",
            minimum: -1,
            maximum: 1
        },
        conv: Number
    },
    {
        name: "fees",
        type: "BigInt",
        filter: {
            type: "integer"
        },
        conv: Number,
        expression: '("fees")::bigint'
    },
    {
        name: "rewards",
        type: "BigInt",
        filter: {
            type: "integer"
        },
        conv: Number,
        expression: '("rewards")::bigint'
    },
    {
        name: "virgin",
        type: "SmallInt",
        filter: {
            type: "boolean"
        },
        conv: Boolean,
        immutable: true
    }
];

describe("logic/account", function() {
    var clock, scope, pgp, account, accountCallback, callback;
    var originalPgp = Account.__get__("pgp");

    beforeEach(function() {
        clock = sinon.useFakeTimers();
        scope = {
            schema: {
                validate: sinon.stub(),
                getLastErrors: sinon.stub()
            },
            db: {
                query: sinon.stub(),
                none: sinon.stub()
            },
            library: {
                logger: {
                    error: sinon.stub()
                }
            },
            genesisblock: {
                block: {}
            }
        };
        pgp = {
            QueryFile: function() {}
        };
        //
        Account.__set__("pgp", pgp);
        callback = sinon.stub();
        accountCallback = sinon.stub();
        account = new Account.AccountLogic(scope.db, scope.schema, scope.library.logger, accountCallback);
        // new Account(scope.db, scope.schema, scope.library.logger, accountCallback);
        // account = Account.__get__("self");
        // console.log(account);
    });

    afterEach(function() {
        clock.restore();
        //
        Account.__set__("pgp", originalPgp);
    });

    describe("constructor", function() {
        it("model", function() {
            expect(account.model).to.deep.equal(model);
        });

        it("fields", function() {
            var fields = [
                { field: "username" },
                { field: "isDelegate" },
                { field: "u_isDelegate" },
                { field: "secondSignature" },
                { field: "u_secondSignature" },
                { field: "u_username" },
                { expression: 'UPPER("address")', alias: "address" },
                { expression: "ENCODE(\"publicKey\", 'hex')", alias: "publicKey" },
                {
                    expression: "ENCODE(\"secondPublicKey\", 'hex')",
                    alias: "secondPublicKey"
                },
                { expression: '("balance")::bigint', alias: "balance" },
                { expression: '("u_balance")::bigint', alias: "u_balance" },
                { expression: '("vote")::bigint', alias: "vote" },
                { expression: '("rate")::bigint', alias: "rate" },
                {
                    expression:
                    '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2delegates WHERE "accountId" = a."address")',
                    alias: "delegates"
                },
                {
                    expression:
                    '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_delegates WHERE "accountId" = a."address")',
                    alias: "u_delegates"
                },
                {
                    expression:
                    '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2multisignatures WHERE "accountId" = a."address")',
                    alias: "multisignatures"
                },
                {
                    expression:
                    '(SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_multisignatures WHERE "accountId" = a."address")',
                    alias: "u_multisignatures"
                },
                { field: "multimin" },
                { field: "u_multimin" },
                { field: "multilifetime" },
                { field: "u_multilifetime" },
                { field: "blockId" },
                { field: "nameexist" },
                { field: "u_nameexist" },
                { field: "producedblocks" },
                { field: "missedblocks" },
                { expression: '("fees")::bigint', alias: "fees" },
                { expression: '("rewards")::bigint', alias: "rewards" },
                { field: "virgin" }
            ];
            expect(account.fields).to.deep.equal(fields);
        });

        it("binary", function() {
            var binary = ["publicKey", "secondPublicKey"];
            expect(account.binary).to.deep.equal(binary);
        });

        it("filter", function() {
            var filter = {
                username: {
                    type: "string",
                    case: "lower",
                    maxLength: 20,
                    minLength: 1
                },
                isDelegate: { type: "boolean" },
                u_isDelegate: { type: "boolean" },
                secondSignature: { type: "boolean" },
                u_secondSignature: { type: "boolean" },
                u_username: {
                    type: "string",
                    case: "lower",
                    maxLength: 20,
                    minLength: 1
                },
                address: {
                    required: true,
                    type: "string",
                    case: "upper",
                    minLength: 1,
                    maxLength: 22
                },
                publicKey: { type: "string", format: "publicKey" },
                secondPublicKey: { type: "string", format: "publicKey" },
                balance: {
                    required: true,
                    type: "integer",
                    minimum: 0,
                    maximum: 10999999991000000
                },
                u_balance: {
                    required: true,
                    type: "integer",
                    minimum: 0,
                    maximum: 10999999991000000
                },
                vote: { type: "integer" },
                rate: { type: "integer" },
                delegates: { type: "array", uniqueItems: true },
                u_delegates: { type: "array", uniqueItems: true },
                multisignatures: { type: "array", uniqueItems: true },
                u_multisignatures: { type: "array", uniqueItems: true },
                multimin: { type: "integer", minimum: 0, maximum: 17 },
                u_multimin: { type: "integer", minimum: 0, maximum: 17 },
                multilifetime: { type: "integer", minimum: 1, maximum: 72 },
                u_multilifetime: { type: "integer", minimum: 1, maximum: 72 },
                blockId: { type: "string", minLength: 1, maxLength: 20 },
                nameexist: { type: "boolean" },
                u_nameexist: { type: "boolean" },
                producedblocks: { type: "integer", minimum: -1, maximum: 1 },
                missedblocks: { type: "integer", minimum: -1, maximum: 1 },
                fees: { type: "integer" },
                rewards: { type: "integer" },
                virgin: { type: "boolean" }
            };
            expect(account.filter).to.deep.equal(filter);
        });

        it("conv", function() {
            var conv = {
                username: String,
                isDelegate: Boolean,
                u_isDelegate: Boolean,
                secondSignature: Boolean,
                u_secondSignature: Boolean,
                u_username: String,
                address: String,
                publicKey: String,
                secondPublicKey: String,
                balance: Number,
                u_balance: Number,
                vote: Number,
                rate: Number,
                delegates: Array,
                u_delegates: Array,
                multisignatures: Array,
                u_multisignatures: Array,
                multimin: Number,
                u_multimin: Number,
                multilifetime: Number,
                u_multilifetime: Number,
                blockId: String,
                nameexist: Boolean,
                u_nameexist: Boolean,
                producedblocks: Number,
                missedblocks: Number,
                fees: Number,
                rewards: Number,
                virgin: Boolean
            };
            expect(account.conv).to.deep.equal(conv);
        });

        it("editable", function() {
            var editable = [
                "isDelegate",
                "u_isDelegate",
                "secondSignature",
                "u_secondSignature",
                "balance",
                "u_balance",
                "vote",
                "rate",
                "delegates",
                "u_delegates",
                "multisignatures",
                "u_multisignatures",
                "multimin",
                "u_multimin",
                "multilifetime",
                "u_multilifetime",
                "blockId",
                "nameexist",
                "u_nameexist",
                "producedblocks",
                "missedblocks",
                "fees",
                "rewards"
            ];
            expect(account.editable).to.deep.equal(editable);
        });

        it("callback", function() {
            clock.tick();
            expect(accountCallback.calledOnce).to.be.true;
            expect(accountCallback.getCall(0).args.length).to.equal(2);
            expect(accountCallback.getCall(0).args[0]).to.be.null;
            expect(accountCallback.getCall(0).args[1]).to.be.instanceof(Account.AccountLogic);
        });
    });

    describe("account.createTables", function() {
        var sqlPath = path.join(process.cwd(), "sql", "memoryTables.sql");

        beforeEach(function() {
            sinon.stub(pgp, "QueryFile");
        });

        afterEach(function() {
            pgp.QueryFile.restore();
        });

        it("sql error", function(done) {
            var error = { stack: "error" };

            scope.db.query.rejects(error);

            account.createTables(callback).then(() => {
                done(new Error('Expected method to reject.'))
            }).catch(function(errorMessage) {
                expect(pgp.QueryFile.calledOnce).to.be.true;
                expect(pgp.QueryFile.getCall(0).args.length).to.equal(2);
                expect(pgp.QueryFile.getCall(0).args[0]).to.equal(sqlPath);
                expect(pgp.QueryFile.getCall(0).args[1]).to.deep.equal({ minify: true });

                expect(scope.db.query.calledOnce).to.be.true;
                expect(scope.db.query.getCall(0).args.length).to.equal(1);
                expect(scope.db.query.getCall(0).args[0]).to.be.instanceof(pgp.QueryFile);

                expect(scope.library.logger.error.calledOnce).to.be.true;
                expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                    error.stack
                );

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal(
                    "Account#createTables error"
                );

                expect(errorMessage).to.equal("Account#createTables error");
                done();
            });
        });

        it("sql success", function() {
            scope.db.query.returns(Promise.resolve());//();

            return account.createTables(callback)
                .then(function() {
                    expect(pgp.QueryFile.calledOnce).to.be.true;
                    expect(pgp.QueryFile.getCall(0).args.length).to.equal(2);
                    expect(pgp.QueryFile.getCall(0).args[0]).to.equal(sqlPath);
                    expect(pgp.QueryFile.getCall(0).args[1]).to.deep.equal({ minify: true });

                    expect(scope.db.query.calledOnce).to.be.true;
                    expect(scope.db.query.getCall(0).args.length).to.equal(1);
                    expect(scope.db.query.getCall(0).args[0]).to.be.instanceof(pgp.QueryFile);
                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(0);
                });
        });
    });

    describe("account.removeTables", function() {
        var tables = [
            table,
            "mem_round",
            "mem_accounts2delegates",
            "mem_accounts2u_delegates",
            "mem_accounts2multisignatures",
            "mem_accounts2u_multisignatures"
        ];
        var sqles = tables.map(function(table) {
            var sql = jsonSql.build({
                type: "remove",
                table: table
            });
            return sql.query;
        });

        it("error", function(done) {
            var error = { stack: "error" };

            clock.restore();
            scope.db.query.rejects(error);

            account.removeTables(callback).then(function() {
                done(new Error('Expected method to reject.'))
            }).catch(function() {
                expect(scope.db.query.calledOnce).to.be.true;
                expect(scope.db.query.getCall(0).args.length).to.equal(1);
                expect(scope.db.query.getCall(0).args[0]).to.deep.equal(sqles.join(""));

                expect(scope.library.logger.error.calledOnce).to.be.true;
                expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                    error.stack
                );

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal(
                    "Account#removeTables error"
                );
                done();

            });
        });

        it("success", function() {
            clock.restore();
            scope.db.query.resolves();

            account.removeTables(callback);

            expect(scope.db.query.calledOnce).to.be.true;
            expect(scope.db.query.getCall(0).args.length).to.equal(1);
            expect(scope.db.query.getCall(0).args[0]).to.deep.equal(sqles.join(""));

            setImmediate(function() {
                setImmediate(function() {
                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(0);
                    done();
                });
            });
        });
    });

    describe("account.objectNormalize", function() {
        var accountData = {};

        it("validation error", function() {
            var errors = [{ message: "error 1" }, { message: "error 2" }];
            var errorMessage =
                "Failed to validate account schema: " +
                errors
                .map(function(error) {
                    return error.message;
                })
                .join(", ");

            scope.schema.validate.returns(false);
            scope.schema.getLastErrors.returns(errors);

            expect(account.objectNormalize.bind(account, accountData)).to.throw(
                errorMessage
            );

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.getCall(0).args.length).to.equal(2);
            expect(scope.schema.validate.getCall(0).args[0]).to.equal(accountData);
            expect(scope.schema.validate.getCall(0).args[1]).to.deep.equal({
                id: "Account",
                object: true,
                properties: account.filter
            });

            expect(scope.schema.getLastErrors.calledOnce).to.be.true;
            expect(scope.schema.getLastErrors.getCall(0).args.length).to.equal(0);
        });

        it("success", function() {
            scope.schema.validate.returns(true);

            expect(account.objectNormalize(accountData)).to.equal(accountData);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.getCall(0).args.length).to.equal(2);
            expect(scope.schema.validate.getCall(0).args[0]).to.equal(accountData);
            expect(scope.schema.validate.getCall(0).args[1]).to.deep.equal({
                id: "Account",
                object: true,
                properties: account.filter
            });
        });
    });

    describe("account.verifyPublicKey", function() {
        it("public key is not a string error", function() {
            var error = "Invalid public key, must be a string";
            expect(() => account.assertPublicKey(null)).to.throw(error);
        });

        it("public key is too short error", function() {
            var error = "Invalid public key, must be 64 characters long";

            expect(() => account.assertPublicKey('short string')).to.throw(error);

        });

        it("should call through schema hex validation.", function() {
            scope.schema.validate = sinon.stub().returns(false);
            var publicKey = '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da';
            expect(() => account.assertPublicKey(publicKey)).to.throw('Invalid public key, must be a hex string');
            expect(scope.schema.validate.calledOnce).is.true;
            expect(scope.schema.validate.firstCall.args[0]).to.be.eq(publicKey);
            expect(scope.schema.validate.firstCall.args[1]).to.be.deep.eq({format: 'hex'});
        });
    });

    describe("account.toDB", function() {
        it("test", function() {
            var raw = {
                publicKey:
                "29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da",
                address: "2841811297332056155r"
            };

            var result = account.toDB(raw);

            expect(result.publicKey).to.deep.equal(new Buffer(raw.publicKey, "hex"));
            expect(result.address).to.equal(raw.address.toUpperCase());
        });
    });

    describe("account.get", function() {
        var data = ["some data"],
            filter = {};

        beforeEach(function() {
            sinon.stub(account, "getAll");
            //
        });

        afterEach(function() {
            account.getAll.restore();
            //
        });

        it("without fields; getAll error", function(done) {
            var error = "error";
            var fields = account.fields.map(function(field) {
                return field.alias || field.field;
            });

            account.getAll.returns(Promise.reject(error));

            account.get(filter, callback).then(() => {
                done(new Error("Should rejects"));
            }).catch(err => {
                expect(err).to.equal(error)
                expect(account.getAll.calledOnce).to.be.true;
                expect(account.getAll.getCall(0).args.length).to.equal(2);
                expect(account.getAll.getCall(0).args[0]).to.equal(filter);
                expect(account.getAll.getCall(0).args[1]).to.deep.equal(fields);
                done();
            });
        });

        it("with fields; getAll error", function(done) {
            var error = "error";
            var fields = {};

            account.getAll.returns(Promise.reject(error));

            account.get(filter, fields, callback).then(() => {
                done(new Error("Should rejects"));
            }).catch(err => {
                expect(account.getAll.calledOnce).to.be.true;
                expect(account.getAll.getCall(0).args.length).to.equal(2);
                expect(account.getAll.getCall(0).args[0]).to.equal(filter);
                expect(account.getAll.getCall(0).args[1]).to.equal(fields);

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal(error);
                done();
            });
        });

        it("without fields", function(done) {
            var fields = account.fields.map(function(field) {
                return field.alias || field.field;
            });

            account.getAll.returns(Promise.resolve(data));

            account.get(filter, callback).then(() => {
                expect(account.getAll.calledOnce).to.be.true;
                expect(account.getAll.getCall(0).args.length).to.equal(2);
                expect(account.getAll.getCall(0).args[0]).to.equal(filter);
                expect(account.getAll.getCall(0).args[1]).to.deep.equal(fields);

                expect(callback.calledOnce).to.be.true;

                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.equal(null);
                expect(callback.getCall(0).args[1]).to.equal(data[0]);
                done();
            }).catch(err => {
                done(new Error("Should resolves"));
            });
        });

        it("with fields", function(done) {
            var fields = {};

            account.getAll.returns(Promise.resolve(data));

            account.get(filter, fields, callback).then(() => {
                expect(account.getAll.calledOnce).to.be.true;
                expect(account.getAll.getCall(0).args.length).to.equal(2);
                expect(account.getAll.getCall(0).args[0]).to.equal(filter);
                expect(account.getAll.getCall(0).args[1]).to.equal(fields);

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.equal(null);
                expect(callback.getCall(0).args[1]).to.equal(data[0]);
                done();
            }).catch(err => {
                done(new Error("Should resolves"))
            });
        });
    });

    describe("account.getAll", function() {
        var filter, fields, sql, shortSql, rows;

        beforeEach(function() {
            filter = {
                limit: 4,
                offset: 2,
                sort: "username",
                address: "2841811297332056155r"
            };
            fields = [];
            sql =
                'select "username", "isDelegate", "u_isDelegate", "secondSignature", "u_secondSignature", "u_username", UPPER("address") as "address", ENCODE("publicKey", \'hex\') as "publicKey", ENCODE("secondPublicKey", \'hex\') as "secondPublicKey", ("balance")::bigint as "balance", ("u_balance")::bigint as "u_balance", ("vote")::bigint as "vote", ("rate")::bigint as "rate", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2delegates WHERE "accountId" = a."address") as "delegates", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_delegates WHERE "accountId" = a."address") as "u_delegates", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2multisignatures WHERE "accountId" = a."address") as "multisignatures", (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_multisignatures WHERE "accountId" = a."address") as "u_multisignatures", "multimin", "u_multimin", "multilifetime", "u_multilifetime", "blockId", "nameexist", "u_nameexist", "producedblocks", "missedblocks", ("fees")::bigint as "fees", ("rewards")::bigint as "rewards", "virgin" from "mem_accounts" as "a" where upper("address") = upper(${p1}) order by "username" limit 4 offset 2;';
            shortSql =
                'select * from "mem_accounts" as "a" where upper("address") = upper(${p1}) order by "username" limit 4 offset 2;';
            rows = [];
        });

        it("without fields; error", function(done) {
            var error = { stack: "error" };

            scope.db.query.rejects(error);

            account.getAll(filter, callback).then(() => {
                done(new Error("Should rejects"));
            }).catch(err => {
                expect(scope.db.query.calledOnce).to.be.true;
                expect(scope.db.query.getCall(0).args.length).to.equal(2);
                expect(scope.db.query.getCall(0).args[0]).to.equal(sql);
                expect(scope.db.query.getCall(0).args[1]).to.deep.equal({
                    p1: "2841811297332056155r"
                });

                expect(scope.library.logger.error.calledOnce).to.be.true;
                expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                    error.stack
                );

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Account#getAll error");
                done();
            });
        });

        it("without fields; success", function(done) {
            scope.db.query.resolves(rows);

            account.getAll(filter, callback).then(() => {
                expect(scope.db.query.calledOnce).to.be.true;
                expect(scope.db.query.getCall(0).args.length).to.equal(2);
                expect(scope.db.query.getCall(0).args[0]).to.equal(sql);
                expect(scope.db.query.getCall(0).args[1]).to.deep.equal({
                    p1: "2841811297332056155r"
                });

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.equal(null);
                expect(callback.getCall(0).args[1]).to.equal(rows);
                done();
            }).catch(err => {
                done(new Error("Should rejects"));
            });
        });

        it("with fields; error", function(done) {
            var error = { stack: "error" };

            scope.db.query.rejects(error);

            account.getAll(filter, fields, callback).then(() => {
                done(new Error("Should rejects"));
            }).catch(err => {
                expect(scope.db.query.calledOnce).to.be.true;
                expect(scope.db.query.getCall(0).args.length).to.equal(2);
                expect(scope.db.query.getCall(0).args[0]).to.equal(shortSql);
                expect(scope.db.query.getCall(0).args[1]).to.deep.equal({
                    p1: "2841811297332056155r"
                });

                expect(scope.library.logger.error.calledOnce).to.be.true;
                expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                    error.stack
                );

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Account#getAll error");
                done();
            });
        });

        it("with fields; success", function() {
            clock.restore();


            scope.db.query.resolves(rows);

            account.getAll(filter, fields, callback);

            expect(scope.db.query.calledOnce).to.be.true;
            expect(scope.db.query.getCall(0).args.length).to.equal(2);
            expect(scope.db.query.getCall(0).args[0]).to.equal(shortSql);
            expect(scope.db.query.getCall(0).args[1]).to.deep.equal({
                p1: "2841811297332056155r"
            });

            setImmediate(function() {
                setImmediate(function() {
                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(2);
                    expect(callback.getCall(0).args[0]).to.equal(null);
                    expect(callback.getCall(0).args[1]).to.equal(rows);
                    done();
                });
            });
        });
    });

    describe("account.set", function() {
        var address = "2841811297332056155r";
        var fields = {};
        var sql =
            'insert into "mem_accounts" ("address") values (${p1}) on conflict ("address") do update set "address" = ${p2};';
        var values = { p1: "2841811297332056155R", p2: "2841811297332056155R" };

        beforeEach(function() {
            sinon.stub(account, "verifyPublicKey");
        });

        afterEach(function() {
            account.assertPublicKey.restore();
        });

        // it("verify throws error", function() {
        //   account.verifyPublicKey.throws("error");
        //
        //   expect(account.set.bind(account, address, fields, callback)).to.throw();
        // });

        it("error", function() {
            var error = { stack: "error" };

            account.assertPublicKey.returns(true);
            scope.db.none.rejects(error);

            return account.set(address, fields, callback)
                .then(() => Promise.reject('should have failed'))
                .catch((err) => expect(err).to.be.deep.eq('Account#set error'))
                .then(() => {
                    expect(scope.db.none.calledOnce).to.be.true;
                    expect(scope.db.none.getCall(0).args.length).to.equal(2);
                    expect(scope.db.none.getCall(0).args[0]).to.equal(sql);
                    expect(scope.db.none.getCall(0).args[1]).to.deep.equal(values);
                });

        });

        it("success", function() {
            account.assertPublicKey.returns(true);
            scope.db.none.resolves();

            return account.set(address, fields, callback)
                .then(() => {
                    expect(scope.db.none.calledOnce).to.be.true;
                    expect(scope.db.none.getCall(0).args.length).to.equal(2);
                    expect(scope.db.none.getCall(0).args[0]).to.equal(sql);
                    expect(scope.db.none.getCall(0).args[1]).to.deep.equal(values);
                    expect(callback.calledOnce).to.be.true;

                    expect(callback.getCall(0).args[1]).to.not.exist;
                });
        });
    });

    describe("account.merge", function() {
        var address, diff, queries;

        beforeEach(function() {
            address = "2841811297332056155r";
            diff = {
                publicKey:
                "29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da",
                blockId: "11273313233467167051",
                round: 2707,
                balance: 300,
                u_balance: -300,
                multisignatures: [
                    {
                        action: "+",
                        dependentId: "11995752116878847490R"
                    },
                    {
                        action: "-",
                        dependentId: "11995752116878847490R"
                    }
                ],
                delegates: [
                    [
                        "+",
                        "5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde"
                    ],
                    [
                        "-",
                        "5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde"
                    ]
                ]
            };
            queries =
                'delete from "mem_accounts2delegates" where "dependentId" in (5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde) and "accountId" = \'2841811297332056155R\';insert into "mem_accounts2delegates" ("accountId", "dependentId") values (\'2841811297332056155R\', 5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde);delete from "mem_accounts2multisignatures" where "dependentId" = \'11995752116878847490R\';insert into "mem_accounts2multisignatures" ("dependentId") values (\'11995752116878847490R\');update "mem_accounts" set "balance" = "balance" + 300, "u_balance" = "u_balance" - 300, "virgin" = 0, "blockId" = \'11273313233467167051\' where "address" = \'2841811297332056155R\';INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT \'2841811297332056155R\', (300)::bigint, "dependentId", \'11273313233467167051\', 2707 FROM mem_accounts2delegates WHERE "accountId" = \'2841811297332056155R\';INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT \'2841811297332056155R\', (balance)::bigint, array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'], \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT \'2841811297332056155R\', (-balance)::bigint, array[\'5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde\'], \'11273313233467167051\', 2707 FROM mem_accounts WHERE address = \'2841811297332056155R\';';
            sinon.stub(account, "verifyPublicKey");
            account.assertPublicKey.returns(true);
        });

        afterEach(function() {
            account.assertPublicKey.restore();
        });

        it("verify throws error", function() {
            account.assertPublicKey.throws("error");

            expect(account.merge.bind(account, address, diff, callback)).to.throw();
        });

        it("no queries", function() {
            scope.db.query.returns(Promise.resolve([]));
            return account.merge(address, {}, callback)
                .then(() => {
                    // console.log(scope.db.none.firstCall.args);
                    expect(scope.db.none.called).to.be.false;
                    // expect(callback.called).to.be.false;

                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(2);
                    expect(callback.getCall(0).args[0]).to.be.null;
                    expect(callback.getCall(0).args[1]).to.be.undefined;
                });


        });

        it("no callback", function() {
            Account.__set__("pgp", originalPgp);

            var testQueries = account.merge(address, diff);

            expect(testQueries).to.equal(queries);
        });

        it("callback error", function() {
            var error = { stack: "error" };
            Account.__set__("pgp", originalPgp);
            scope.db.none.rejects(error);

            return account.merge(address, diff, callback)
                .then(() => Promise.reject('Should have failed'))
                .catch((err) => expect(err).to.be.eq('Account#merge error'))
                .then(() => {
                    expect(scope.db.none.calledOnce).to.be.true;
                    expect(scope.db.none.getCall(0).args.length).to.equal(1);
                    expect(scope.db.none.getCall(0).args[0]).to.equal(queries);
                    expect(scope.library.logger.error.calledOnce).to.be.true;
                    expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                    expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                        error.stack
                    );

                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(1);
                    expect(callback.getCall(0).args[0]).to.equal("Account#merge error");
                });
        });

        it("callback success", function() {
            clock.restore();
            Account.__set__("pgp", originalPgp);
            scope.db.none.returns(Promise.resolve());
            scope.db.query.returns(Promise.resolve([]));
            return account.merge(address, diff, callback)
                .then(() => {
                    expect(scope.db.none.calledOnce).to.be.true;
                    expect(scope.db.none.getCall(0).args.length).to.equal(1);
                    expect(scope.db.none.getCall(0).args[0]).to.equal(queries);
                    expect(callback.calledOnce).to.be.true;
                    expect(callback.getCall(0).args.length).to.equal(2);
                    expect(callback.getCall(0).args[0]).to.be.null;
                    expect(callback.getCall(0).args[1]).to.be.undefined;
                });
        });

    });

    describe("account.remove", function() {
        var address = "2841811297332056155R";
        var queries = 'delete from "mem_accounts" where "address" = ${p1};';
        var values = { p1: "2841811297332056155R" };

        it("promise rejects", function(done) {
            var error = { stack: "error" };
            scope.db.none.rejects(error);

            account.remove(address, callback).then(() => {
                done(new Error("Should rejects"));
            }).catch(err => {
                expect(scope.db.none.calledOnce).to.be.true;
                expect(scope.db.none.getCall(0).args.length).to.equal(2);
                expect(scope.db.none.getCall(0).args[0]).to.equal(queries);
                expect(scope.db.none.getCall(0).args[1]).to.deep.equal(values);

                expect(scope.library.logger.error.calledOnce).to.be.true;
                expect(scope.library.logger.error.getCall(0).args.length).to.equal(1);
                expect(scope.library.logger.error.getCall(0).args[0]).to.equal(
                    error.stack
                );

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(1);
                expect(callback.getCall(0).args[0]).to.equal("Account#remove error");
                done();
            });
        });

        it("promise resolves", function(done) {
            scope.db.none.resolves();

            account.remove(address, callback).then((addr) => {
                expect(scope.db.none.calledOnce).to.be.true;
                expect(scope.db.none.getCall(0).args.length).to.equal(2);
                expect(scope.db.none.getCall(0).args[0]).to.equal(queries);
                expect(scope.db.none.getCall(0).args[1]).to.deep.equal(values);

                expect(callback.calledOnce).to.be.true;
                expect(callback.getCall(0).args.length).to.equal(2);
                expect(callback.getCall(0).args[0]).to.equal(null);
                expect(callback.getCall(0).args[1]).to.equal(address);
                expect(addr).to.equal(address);
                done();
            }).catch(err => {
                done(new Error("Should resolves"));
            });
        });
    });
});
