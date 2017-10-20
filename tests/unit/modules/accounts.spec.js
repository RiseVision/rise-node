var path = require("path");
var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var crypto = require("crypto");

var rootDir = path.join(__dirname, "../../..");

var Accounts = rewire(path.join(rootDir, "modules/accounts"));
var Vote = require(path.join(rootDir, "logic/vote"));
var ed = require(path.join(rootDir, "helpers/ed"));
var constants = require(path.join(rootDir, "helpers/constants"));
var schema = require(path.join(rootDir, "schema/accounts"));
var transactionTypes = require(path.join(rootDir, "helpers/transactionTypes"));

describe("modules/accounts", function() {
    it("constructor", function() {
        expect(Accounts).to.be.a('function');

        var clock = sinon.useFakeTimers();
        Accounts.__set__("setImmediate", setImmediate);

        var scope = {
            logic : {
                transaction : {
                    attachAssetType : sinon.spy()
                }
            } 
        };
        var callback = sinon.spy();
        var account = new Accounts(callback, scope);

        expect(scope.logic.transaction.attachAssetType.calledOnce).to.be.true;

        expect(scope.logic.transaction.attachAssetType.firstCall.args.length).to.equal(2);
        expect(scope.logic.transaction.attachAssetType.firstCall.args[0]).to.equal(transactionTypes.VOTE);
        expect(scope.logic.transaction.attachAssetType.firstCall.args[1]).to.be.an.instanceof(Vote);

        clock.tick();
        expect(callback.called).to.be.true;
        expect(callback.calledOnce).to.be.true;
        expect(callback.calledWith(null, account));

        clock.restore();
        Accounts.__set__("setImmediate", setImmediate);
    });
});

describe("modules/accounts", function() {

    var scope, callback, account, secret, secondSecret, testAccount;

    beforeEach(function() {
        scope = {
            logic : {
                transaction : {
                    attachAssetType : sinon.spy(),
                    create : function(){}
                },
                account : {
                    set : sinon.stub(),
                    get : sinon.stub(),
                    getAll : sinon.stub(),
                    merge : sinon.stub()
                }
            },
            schema : {
                validate : function(){}
            },
            balancesSequence : {
                add : function(){}
            },
            ed : ed
        };
        callback = sinon.spy();
        account = new Accounts(function() {}, scope);
        secret = "first secret key";
        secondSecret = "second secret key";
        testAccount = {
            address: '2841811297332056155R',
            u_balance: '0',
            balance: '0',
            publicKey: '29cca24dae30655882603ba49edba31d956c2e79a062c9bc33bcae26138b39da',
            u_secondSignature: 0,
            secondSignature: 0,
            secondPublicKey : '713b42eeaf2958a229b0d037203f57cfbd25e20f2d35e51b59943b4ce1090c75',
            multisignatures: null,
            u_multisignatures: null 
        };
    });

    describe("private.openAccount", function() {
        var clock;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            sinon.stub(account, "getAccount");

            account.getAccount.callsArgWith(1, null, testAccount);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("getAccount returns error", function() {
            var error = "error";
            account.getAccount.callsArgWith(1, error);

            Accounts.__get__("__private").openAccount(secret, callback);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({publicKey : testAccount.publicKey});
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("getAccount returns existed account without publicKey", function() {
            var alteredAccount = Object.assign({}, testAccount);
            delete alteredAccount.publicKey;
            account.getAccount.callsArgWith(1, null, alteredAccount);

            Accounts.__get__("__private").openAccount(secret, callback);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({publicKey : testAccount.publicKey});
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal(testAccount);
        });

        it("getAccount returns existed account with publicKey", function() {
            Accounts.__get__("__private").openAccount(secret, callback);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({publicKey : testAccount.publicKey});
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal(testAccount);
        });

        it("getAccount returns empty account", function() {
            testAccount.secondPublicKey = null;
            account.getAccount.callsArgWith(1, null, null);

            Accounts.__get__("__private").openAccount(secret, callback);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({publicKey : testAccount.publicKey});
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal(testAccount);
        });
    });
    
    describe("public.generateAddressByPublicKey", function() {
        it("incorrect input", function() {
            expect(function() {
                account.generateAddressByPublicKey(null);
            }).to.throw();
        });

        it("correct input", function() {
            expect(function() {
                account.generateAddressByPublicKey(testAccount.publicKey);
            }).to.not.throw();
            expect(account.generateAddressByPublicKey(testAccount.publicKey)).to.equal(testAccount.address);
        });
    });
   
    describe("public.getAccount", function() {
        var testObj1, testObj2;

        beforeEach(function() {
            testObj1 = {};
            testObj2 = {};
        });

        it("with publicKey", function() {
            account.getAccount({ publicKey : testAccount.publicKey }, testObj1, callback);

            expect(scope.logic.account.get.calledOnce).to.be.true;
            expect(scope.logic.account.get.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.get.firstCall.args[0]).to.deep.equal({ address : testAccount.address });
            expect(scope.logic.account.get.firstCall.args[1]).to.equal(testObj1);
            expect(scope.logic.account.get.firstCall.args[2]).to.equal(callback);
        });

        it("without publicKey", function() {
            account.getAccount({ address : testAccount.address }, testObj1, callback);

            expect(scope.logic.account.get.calledOnce).to.be.true;
            expect(scope.logic.account.get.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.get.firstCall.args[0]).to.deep.equal({ address : testAccount.address });
            expect(scope.logic.account.get.firstCall.args[1]).to.equal(testObj1);
            expect(scope.logic.account.get.firstCall.args[2]).to.equal(callback);
        });
    });

    describe("public.getAccounts", function() {
        it("library.logic.account called", function() {
            var filter = {};
            var fields = {};

            account.getAccounts(filter, fields, callback);

            expect(scope.logic.account.getAll.calledOnce).to.be.true;
            expect(scope.logic.account.getAll.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.getAll.firstCall.args[0]).to.equal(filter);
            expect(scope.logic.account.getAll.firstCall.args[1]).to.equal(fields);
            expect(scope.logic.account.getAll.firstCall.args[2]).to.equal(callback);
        });
    });

    describe("public.setAccountAndGet", function() {
        var clock;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            sinon.stub(account, "generateAddressByPublicKey")
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
            account.generateAddressByPublicKey.restore();
        });

        it("no address, no public key, callback doesn't exist", function() {
            var data = {}; 

            expect(account.setAccountAndGet.bind(account, data)).to.throws("Invalid public key");
        });

        it("no address, no public key, callback exists", function() {
            var data = {}; 

            account.setAccountAndGet(data, callback);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid public key");
        });

        it("no address, publicKey exists, generating address error, callback doesn't exist", function() {
            var data = {
                publicKey : testAccount.publicKey
            };
            account.generateAddressByPublicKey.returns(null);

            expect(account.setAccountAndGet.bind(account, data)).to.throw("Invalid public key");
        });

        it("no address, publicKey exists, generating address error, callback exists", function() {
            var data = {
                publicKey : testAccount.publicKey
            };
            account.generateAddressByPublicKey.returns(null);

            account.setAccountAndGet(data, callback);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid public key");
        });

        it("no address, publicKey exists, account.set error", function() {
            var error = "Error";
            var data = {
                publicKey : testAccount.publicKey
            };
            account.generateAddressByPublicKey.returns(testAccount.address);
            scope.logic.account.set.callsArgWith(2, error);

            account.setAccountAndGet(data, callback);

            expect(scope.logic.account.set.calledOnce).to.be.true;
            expect(scope.logic.account.set.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.set.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.set.firstCall.args[1]).to.equal(data);
            expect(scope.logic.account.set.firstCall.args[2]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("no address, publicKey exists, account.set success", function() {
            var data = {
                publicKey : testAccount.publicKey
            };
            account.generateAddressByPublicKey.returns(testAccount.address);
            scope.logic.account.set.callsArgWith(2, null);

            account.setAccountAndGet(data, callback);

            expect(scope.logic.account.set.calledOnce).to.be.true;
            expect(scope.logic.account.set.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.set.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.set.firstCall.args[1]).to.equal(data);
            expect(scope.logic.account.set.firstCall.args[2]).to.be.a("function");

            expect(scope.logic.account.get.calledOnce).to.be.true;
            expect(scope.logic.account.get.firstCall.args.length).to.equal(2);
            expect(scope.logic.account.get.firstCall.args[0]).to.deep.equal({address : testAccount.address});
            expect(scope.logic.account.get.firstCall.args[1]).to.equal(callback);
        });

        it("address exists, account.set error", function() {
            var error = "Error";
            var data = {
                publicKey : testAccount.publicKey,
                address   : testAccount.address
            };
            scope.logic.account.set.callsArgWith(2, error);

            account.setAccountAndGet(data, callback);

            expect(scope.logic.account.set.calledOnce).to.be.true;
            expect(scope.logic.account.set.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.set.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.set.firstCall.args[1]).to.equal(data);
            expect(scope.logic.account.set.firstCall.args[2]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("address exists, account.set success", function() {
            var data = {
                publicKey : testAccount.publicKey,
                address   : testAccount.address
            };
            scope.logic.account.set.callsArgWith(2, null);

            account.setAccountAndGet(data, callback);

            expect(scope.logic.account.set.calledOnce).to.be.true;
            expect(scope.logic.account.set.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.set.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.set.firstCall.args[1]).to.equal(data);
            expect(scope.logic.account.set.firstCall.args[2]).to.be.a("function");

            expect(scope.logic.account.get.calledOnce).to.be.true;
            expect(scope.logic.account.get.firstCall.args.length).to.equal(2);
            expect(scope.logic.account.get.firstCall.args[0]).to.deep.equal({address : testAccount.address});
            expect(scope.logic.account.get.firstCall.args[1]).to.equal(callback);
        });
    });
   
    describe("public.mergeAccountAndGet", function() {
        var clock;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            sinon.stub(account, "generateAddressByPublicKey");

            account.generateAddressByPublicKey.returns(testAccount.address);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("empty address, correct publicKey", function() {
            var testData = {publicKey : testAccount.publicKey};

            account.mergeAccountAndGet(testData, callback);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.true;
            expect(account.generateAddressByPublicKey.firstCall.args.length).to.equal(1);
            expect(account.generateAddressByPublicKey.firstCall.args[0]).to.equal(testAccount.publicKey);

            expect(scope.logic.account.merge.calledOnce).to.be.true;
            expect(scope.logic.account.merge.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.merge.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.merge.firstCall.args[1]).to.equal(testData);
            expect(scope.logic.account.merge.firstCall.args[2]).to.equal(callback);
        });

        it("empty address, incorrect publicKey, callback exists", function() {
            var testData = {publicKey : null};

            account.mergeAccountAndGet(testData, callback);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid public key");

        });

        it("empty address, incorrect publicKey, callback does not exist", function() {
            var testData = {publicKey : null};

            expect(function() {
                account.mergeAccountAndGet(testData);
            }).to.throws("Invalid public key");
        });

        it("address exists", function() {
            var testData = {address : testAccount.address};

            account.mergeAccountAndGet(testData, callback);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.false;

            expect(scope.logic.account.merge.calledOnce).to.be.true;
            expect(scope.logic.account.merge.firstCall.args.length).to.equal(3);
            expect(scope.logic.account.merge.firstCall.args[0]).to.equal(testAccount.address);
            expect(scope.logic.account.merge.firstCall.args[1]).to.equal(testData);
            expect(scope.logic.account.merge.firstCall.args[2]).to.equal(callback);
        });

    });

    it("public.sandboxApi", function() {
        var testCall = {};
        var testArgs = {};

        var sandboxHelper = require(path.join(rootDir, "helpers/sandbox"));
        var sandboxHelperStub = sinon.spy(sandboxHelper, "callMethod");
        var privateShared = Accounts.__get__("shared");

        account.sandboxApi(testCall, testArgs, callback);

        expect(sandboxHelperStub.calledOnce).to.be.true;
        expect(sandboxHelperStub.firstCall.args.length).to.equal(4);
        expect(sandboxHelperStub.firstCall.args[0]).to.equal(privateShared);
        expect(sandboxHelperStub.firstCall.args[1]).to.equal(testCall);
        expect(sandboxHelperStub.firstCall.args[2]).to.equal(testArgs);
        expect(sandboxHelperStub.firstCall.args[3]).to.equal(callback);

        sandboxHelperStub.restore();
    });

    it("public.onBind", function() {
        var testScope = {
            delegates : {},
            rounds : {},
            system : {}
        };
        var assetFakeBind = sinon.spy();

        scope.logic.transaction.attachAssetType = sinon.stub();
        scope.logic.transaction.attachAssetType.returns({
            bind : assetFakeBind
        });

        account = new Accounts(callback, scope);
        account.onBind(testScope);

        expect(assetFakeBind.calledOnce).to.be.true;
        expect(assetFakeBind.firstCall.args.length).to.equal(3);
        expect(assetFakeBind.firstCall.args[0]).to.equal(testScope.delegates);
        expect(assetFakeBind.firstCall.args[1]).to.equal(testScope.rounds);
        expect(assetFakeBind.firstCall.args[2]).to.equal(testScope.system);
    });

    describe("public.isLoaded", function() {
        it("common", function() {
            var modules = Accounts.__get__("modules");

            expect(account.isLoaded()).to.equal(!!modules);
        });
    });

    describe("share.open", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {}
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(Accounts.__get__("__private"), "openAccount");

            scope.schema.validate.callsArgWith(2, null);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
            Accounts.__get__("__private").openAccount.restore();
        });

        it("validation failed", function() {
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.open(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.open);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("validation passed, open account error", function() {
            var error = "error";
            Accounts.__get__("__private").openAccount.callsArgWith(1, error);

            account.shared.open(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.open);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, account returned", function() {
            var error = "error";
            Accounts.__get__("__private").openAccount.callsArgWith(1, null, testAccount);

            expect(scope.schema.validate.called).to.be.false;

            account.shared.open(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.open);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({
                account : {
                    address: testAccount.address,
                    unconfirmedBalance: testAccount.u_balance,
                    balance: testAccount.balance,
                    publicKey: testAccount.publicKey,
                    unconfirmedSignature: testAccount.u_secondSignature,
                    secondSignature: testAccount.secondSignature,
                    secondPublicKey: testAccount.secondPublicKey,
                    multisignatures: testAccount.multisignatures,
                    u_multisignatures: testAccount.u_multisignatures
                } 
            });
        });

    });

    describe("shared.getBalance", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);

            request = {
                body : {}
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(account, "getAccount");

            scope.schema.validate.callsArgWith(2, null);
            account.getAccount.callsArgWith(1, null, testAccount);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("validation failed", function() {
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.getBalance(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getBalance);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("validation passed, getAccount error", function() {
            request.body.address = testAccount.address;
            var error = "error";
            account.getAccount.callsArgWith(1, error);

            account.shared.getBalance(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getBalance);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns account with empty balance", function() {
            request.body.address = testAccount.address;

            account.shared.getBalance(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getBalance);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({
                balance : testAccount.balance,
                unconfirmedBalance : testAccount.u_balance
            });
        });

        it("validation passed, getAccount returns account with not empty  balance", function() {
            testAccount.balance = '1234';
            testAccount.u_balance = '5678';
            request.body.address = testAccount.address;

            account.shared.getBalance(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getBalance);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick()
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({
                balance : testAccount.balance,
                unconfirmedBalance : testAccount.u_balance
            });
        });

    });

    describe("shared.getPublicKey", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {
                    address : testAccount.address
                }
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(account, "getAccount");

            scope.schema.validate.callsArgWith(2, null);
            account.getAccount.callsArgWith(1, null, testAccount);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("validation failed", function() {
            var errors = [{message : "error"}];
            delete request.body.address;
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.getPublickey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getPublicKey);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("validation passed, getAccount error", function() {
            var error = "error";
            account.getAccount.callsArgWith(1, error);

            account.shared.getPublickey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getPublicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns empty account", function() {
            var error = "Account not found";
            account.getAccount.callsArgWith(1, null, null);

            account.shared.getPublickey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getPublicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns account without publicKey", function() {
            testAccount.publicKey = null;
            var error = "Account not found";

            account.shared.getPublickey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getPublicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns account", function() {
            account.shared.getPublickey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getPublicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({ publicKey : testAccount.publicKey });
        });


    });

    describe("shared.generatePublicKey", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {
                    secret : secret
                }
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(Accounts.__get__("__private"), "openAccount");

            scope.schema.validate.callsArgWith(2, null);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
            Accounts.__get__("__private").openAccount.restore();
        });

        it("validation failed", function() {
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.generatePublicKey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.generatePublicKey);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("validation passed, private.openAccount error", function() {
            var error = "error";
            Accounts.__get__("__private").openAccount.callsArgWith(1, error);

            account.shared.generatePublicKey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.generatePublicKey);

            expect(Accounts.__get__("__private").openAccount.calledOnce).to.be.true;
            expect(Accounts.__get__("__private").openAccount.firstCall.args.length).to.equal(2);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[0]).to.deep.equal(request.body.secret);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(error);
            expect(callback.firstCall.args[1]).to.deep.equal({ publicKey : null });
        });

        it("validation passed, private.openAccount returns empty account", function() {
            Accounts.__get__("__private").openAccount.callsArgWith(1, null, null);

            account.shared.generatePublicKey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.generatePublicKey);

            expect(Accounts.__get__("__private").openAccount.calledOnce).to.be.true;
            expect(Accounts.__get__("__private").openAccount.firstCall.args.length).to.equal(2);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[0]).to.deep.equal(request.body.secret);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({ publicKey : null });
        });

        it("validation passed, private.openAccount returns account", function() {
            Accounts.__get__("__private").openAccount.callsArgWith(1, null, testAccount);

            account.shared.generatePublicKey(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.generatePublicKey);

            expect(Accounts.__get__("__private").openAccount.calledOnce).to.be.true;
            expect(Accounts.__get__("__private").openAccount.firstCall.args.length).to.equal(2);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[0]).to.deep.equal(request.body.secret);
            expect(Accounts.__get__("__private").openAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({ publicKey : testAccount.publicKey });
        });
    });

    describe("shared.getDelegates", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {
                    address : testAccount.address
                }
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(account, "getAccount");

            scope.schema.validate.callsArgWith(2, null);
            account.getAccount.callsArgWith(1, null, testAccount);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });


        it("validation failed", function() {
            delete request.body.address;
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.getDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getDelegates);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("validation passed, getAccount error", function() {
            var error = "error";
            account.getAccount.callsArgWith(1, error);

            account.shared.getDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getDelegates);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns empty account", function() {
            var error = "Account not found";
            account.getAccount.callsArgWith(1, null, null);

            account.shared.getDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getDelegates);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("validation passed, getAccount returns account without delegates", function() {
            account.shared.getDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getDelegates);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({ delegates : [] });
        });

        it("validation passed, getAccount returns account with delegates", function() {
            testAccount.delegates = ['1','2','3','4'];

            var modules = Accounts.__get__('modules');
            modules.delegates = {
                getDelegates : function(){}
            };
            sinon.stub(modules.delegates, "getDelegates");
            modules.delegates.getDelegates.callsArgWith(1, null, { 
                delegates : [
                    { publicKey : '2'},
                    { publicKey : '4'},
                    { publicKey : '5'}
                ]
            });

            account.shared.getDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getDelegates);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            expect(modules.delegates.getDelegates.calledOnce).to.be.true;
            expect(modules.delegates.getDelegates.firstCall.args.length).to.equal(2);
            expect(modules.delegates.getDelegates.firstCall.args[0]).to.equal(request.body);
            expect(modules.delegates.getDelegates.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({ delegates : [{publicKey : '2'},{publicKey : '4'}] });
        });

    });

    it("shared.getDelegatesFee", function(){
        var request = {
            body : {}
        };
        expect(callback.called).to.be.false;
        account.shared.getDelegatesFee(request, callback);
        expect(callback.called).to.be.false;
        setImmediate(function(){
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({fee : constants.fees.delegate});
        });
    });

    describe("shared.addDelegates", function() {
        var clock, request, transaction, transactionInput, modules;

        beforeEach(function() {
            var hash = crypto.createHash('sha256').update(secret, 'utf8').digest();

            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {
                    secret : secret,
                    publicKey : testAccount.publicKey,
                    delegates : []
                }
            };
            transaction = {};
            transactionInput = {
                type: transactionTypes.VOTE,
                votes: request.body.delegates,
                sender: testAccount,
                keypair: ed.makeKeypair(hash),
                secondKeypair: null
            }

            modules = Accounts.__get__('modules')
            modules.transactions = {
                receiveTransactions : function(){}
            };
            modules.accounts = {
                getAccount : function(){}
            };

            sinon.stub(scope.schema, "validate");
            sinon.stub(scope.balancesSequence, "add").callsFake(function(action, cb) {
                action(cb); 
            });
            sinon.stub(modules.accounts, "getAccount");
            sinon.stub(account, "setAccountAndGet");
            sinon.stub(scope.logic.transaction, "create");
            sinon.stub(modules.transactions, "receiveTransactions");

            scope.schema.validate.callsArgWith(2, null);
            modules.accounts.getAccount.callsArgWith(1, null, testAccount);
            account.setAccountAndGet.callsArgWith(1, null, testAccount);
            modules.transactions.receiveTransactions.callsArgWith(2, null, [transaction]);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("validation error", function() {
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);
            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("incorrect secret", function() {
            request.body.publicKey = "incorrect";
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);
            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid passphrase");
        });

        it("multiple sign; first getAccount error", function() {
            var error = "Get account error";
            request.body.multisigAccountPublicKey = secondSecret;
            modules.accounts.getAccount.callsArgWith(1, error);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledOnce).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : secondSecret });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("multiple sign; first getAccount doesn't return account", function() {
            request.body.multisigAccountPublicKey = secondSecret;
            modules.accounts.getAccount.callsArgWith(1, null, null);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledOnce).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : secondSecret });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Multisignature account not found");
        });

        it("multiple sign; first getAccount doesn't return account.publicKey", function() {
            request.body.multisigAccountPublicKey = secondSecret;
            modules.accounts.getAccount.callsArgWith(1, null, {});

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledOnce).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : secondSecret });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Multisignature account not found");
        });

        it("multiple sign; account is not mulisigned", function() {
            request.body.multisigAccountPublicKey = secondSecret;
            modules.accounts.getAccount.callsArgWith(1, null, testAccount);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledOnce).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : secondSecret });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account does not have multisignatures enabled");
        });

        it("multiple sign; account is not in signatures list", function() {
            request.body.multisigAccountPublicKey = secondSecret;
            testAccount.multisignatures = [];
            modules.accounts.getAccount.callsArgWith(1, null, testAccount);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledOnce).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : secondSecret });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account does not belong to multisignature group");
        });

        it("multiple sign; second getAccount error", function() {
            var error = "error";
            request.body.multisigAccountPublicKey = testAccount.secondPublicKey;
            testAccount.multisignatures = [testAccount.publicKey];
            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, testAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, error);
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : testAccount.secondPublicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(testAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("multiple sign; second getAccount doesn't return account", function() {
            request.body.multisigAccountPublicKey = testAccount.secondPublicKey;
            testAccount.multisignatures = [testAccount.publicKey];
            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, testAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, null);
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : testAccount.secondPublicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(testAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Requester not found");
        });

        it("multiple sign; second getAccount doesn't return account.publicKey", function() {
            request.body.multisigAccountPublicKey = testAccount.secondPublicKey;
            testAccount.multisignatures = [testAccount.publicKey];
            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, testAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, {});
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : testAccount.secondPublicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(testAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Requester not found");
        });

        it("multiple sign; invalid second signature", function() {
            testAccount.secondSignature = 1;
            request.body.multisigAccountPublicKey = testAccount.secondPublicKey;
            testAccount.multisignatures = [testAccount.publicKey];
            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, testAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, testAccount);
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : testAccount.secondPublicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(testAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Missing requester second passphrase");
        });

        it("multiple sign; same public keys", function() {
            request.body.multisigAccountPublicKey = testAccount.secondPublicKey;
            testAccount.multisignatures = [testAccount.publicKey];
            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, testAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, testAccount);
            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : testAccount.secondPublicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(testAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid requester public key");
        });

        it("multiple sign; second secret is correct; transaction.create throws error", function() {
            var error = "Transaction error";
            var firstAccount = Object.assign({}, testAccount);
            firstAccount.multisignatures = [testAccount.secondPublicKey];

            var secondAccount = Object.assign({}, testAccount);
            secondAccount.publicKey = firstAccount.secondPublicKey;
            secondAccount.secondSignature = 1;
            secondAccount.secondPublicKey = firstAccount.publicKey;

            request.body.secret = secondSecret;
            request.body.secondSecret = secret;
            request.body.publicKey = secondAccount.publickKey;
            request.body.multisigAccountPublicKey = firstAccount.publicKey;

            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, firstAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, secondAccount);
            scope.logic.transaction.create.throws(error)

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : firstAccount.publicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(secondAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("multiple sign; success", function() {
            var firstAccount = Object.assign({}, testAccount);
            firstAccount.multisignatures = [testAccount.secondPublicKey];

            var secondAccount = Object.assign({}, testAccount);
            secondAccount.publicKey = firstAccount.secondPublicKey;

            request.body.secret = secondSecret;
            request.body.secondSecret = secret;
            request.body.publicKey = secondAccount.publickKey;
            request.body.multisigAccountPublicKey = firstAccount.publicKey;

            var hash = crypto.createHash('sha256').update(secondSecret, 'utf8').digest();
            transactionInput.keypair = ed.makeKeypair(hash);
            transactionInput.sender = firstAccount;
            transactionInput.requester = transactionInput.keypair;

            modules.accounts.getAccount.onCall(0).callsArgWith(1, null, firstAccount);
            modules.accounts.getAccount.onCall(1).callsArgWith(1, null, secondAccount);
            scope.logic.transaction.create.returns(transaction);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(modules.accounts.getAccount.calledTwice).to.be.true;
            expect(modules.accounts.getAccount.firstCall.args.length).to.equal(2);
            expect(modules.accounts.getAccount.firstCall.args[0]).to.deep.equal({ publicKey : firstAccount.publicKey });
            expect(modules.accounts.getAccount.firstCall.args[1]).to.be.a("function");
            expect(modules.accounts.getAccount.getCall(1).args.length).to.equal(2);
            expect(modules.accounts.getAccount.getCall(1).args[0]).to.deep.equal({ publicKey : new Buffer(secondAccount.publicKey, "hex") });
            expect(modules.accounts.getAccount.getCall(1).args[1]).to.be.a("function");

            expect(scope.logic.transaction.create.calledOnce).to.be.true;
            expect(scope.logic.transaction.create.firstCall.args.length).to.equal(1);
            expect(scope.logic.transaction.create.firstCall.args[0]).to.deep.equal(transactionInput);

            expect(modules.transactions.receiveTransactions.calledOnce).to.be.true;
            expect(modules.transactions.receiveTransactions.firstCall.args.length).to.equal(3);
            expect(modules.transactions.receiveTransactions.firstCall.args[0]).to.deep.equal([transaction]);

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({transaction : transaction});
        });


        it("single sign; getAccount error", function() {
            var error = "Set account error";
            account.setAccountAndGet.callsArgWith(1, error);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("single sign; getAccount doesn't return account", function() {
            account.setAccountAndGet.callsArgWith(1, null, null);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account not found");
        });

        it("single sign; getAccount doesn't return account.publicKey", function() {
            account.setAccountAndGet.callsArgWith(1, null, {});

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account not found");
        });

        it("single sign; invalid second signature", function() {
            testAccount.secondSignature = 1;

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Invalid second passphrase");
        });

        it("single sign; second secret is correct; transaction.create throws error", function() {
            testAccount.secondSignature = 1;
            request.body.secondSecret = secondSecret;
            scope.logic.transaction.create.throws("Transaction error")

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Transaction error");
        });

        it("single sign; success", function() {
            scope.logic.transaction.create.returns(transaction);

            account.shared.addDelegates(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.addDelegates);

            expect(scope.balancesSequence.add.calledOnce).to.be.true;
            expect(scope.balancesSequence.add.firstCall.args.length).to.equal(2);
            expect(scope.balancesSequence.add.firstCall.args[0]).to.be.a("function");
            expect(scope.balancesSequence.add.firstCall.args[1]).to.be.a("function");

            expect(account.setAccountAndGet.calledOnce).to.be.true;
            expect(account.setAccountAndGet.firstCall.args.length).to.equal(2);
            expect(account.setAccountAndGet.firstCall.args[0]).to.deep.equal({ publicKey : request.body.publicKey });
            expect(account.setAccountAndGet.firstCall.args[1]).to.be.a("function");

            expect(scope.logic.transaction.create.calledOnce).to.be.true;
            expect(scope.logic.transaction.create.firstCall.args.length).to.equal(1);
            expect(scope.logic.transaction.create.firstCall.args[0]).to.deep.equal(transactionInput);

            expect(modules.transactions.receiveTransactions.calledOnce).to.be.true;
            expect(modules.transactions.receiveTransactions.firstCall.args.length).to.equal(3);
            expect(modules.transactions.receiveTransactions.firstCall.args[0]).to.deep.equal([transaction]);

            expect(callback.called).to.be.false;
            clock.tick(2);
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({transaction : transaction});
        });
    });

    describe("shared.getAccount", function() {
        var clock, request;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            request = {
                body : {
                    secret : secret,
                    address : testAccount.address,
                    publicKey : testAccount.publicKey
                }
            };
            sinon.stub(scope.schema, "validate");
            sinon.stub(account, "generateAddressByPublicKey").returns(testAccount.address);
            sinon.stub(account, "getAccount").callsArgWith(1, null, testAccount);
            scope.schema.validate.callsArgWith(2, null);
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("validation error", function() {
            var errors = [{message : "error"}];
            scope.schema.validate.callsArgWith(2, errors);

            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);
            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(errors[0].message);
        });

        it("no address and public key", function() {
            delete request.body.address;
            delete request.body.publicKey;

            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);
            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Missing required property: address or publicKey");
        });

        it("public key doesn't match address", function() {
            account.generateAddressByPublicKey.returns('incorrect address');

            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.true;
            expect(account.generateAddressByPublicKey.firstCall.args.length).to.equal(1);
            expect(account.generateAddressByPublicKey.firstCall.args[0]).to.equal(request.body.publicKey);

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account publicKey does not match address");
        });

        it("getAccount error", function() {
            var error = "error";
            account.getAccount.callsArgWith(1, error);

            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.true;
            expect(account.generateAddressByPublicKey.firstCall.args.length).to.equal(1);
            expect(account.generateAddressByPublicKey.firstCall.args[0]).to.equal(request.body.publicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("getAccount returns empty account", function() {
            account.getAccount.callsArgWith(1, null, null);

            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.true;
            expect(account.generateAddressByPublicKey.firstCall.args.length).to.equal(1);
            expect(account.generateAddressByPublicKey.firstCall.args[0]).to.equal(request.body.publicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal("Account not found");
        });

        it("success", function() {
            var result = {
                account: {
                    address: testAccount.address,
                    unconfirmedBalance: testAccount.u_balance,
                    balance: testAccount.balance,
                    publicKey: testAccount.publicKey,
                    unconfirmedSignature: testAccount.u_secondSignature,
                    secondSignature: testAccount.secondSignature,
                    secondPublicKey: testAccount.secondPublicKey,
                    multisignatures: testAccount.multisignatures || [],
                    u_multisignatures: testAccount.u_multisignatures || []
                }
            };
            account.shared.getAccount(request, callback);

            expect(scope.schema.validate.calledOnce).to.be.true;
            expect(scope.schema.validate.firstCall.args.length).to.equal(3);
            expect(scope.schema.validate.firstCall.args[0]).to.equal(request.body);
            expect(scope.schema.validate.firstCall.args[1]).to.equal(schema.getAccount);

            expect(account.generateAddressByPublicKey.calledOnce).to.be.true;
            expect(account.generateAddressByPublicKey.firstCall.args.length).to.equal(1);
            expect(account.generateAddressByPublicKey.firstCall.args[0]).to.equal(request.body.publicKey);

            expect(account.getAccount.calledOnce).to.be.true;
            expect(account.getAccount.firstCall.args.length).to.equal(2);
            expect(account.getAccount.firstCall.args[0]).to.deep.equal({ address : request.body.address });
            expect(account.getAccount.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal(result);
        });

    });

    describe("internal.count", function() {
        it("standard", function() {
            Accounts.__get__("__private").accounts = {};
            var accountsLength = Object.keys(Accounts.__get__("__private").accounts).length;

            account.internal.count(null, callback);

            setImmediate(function() {
                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(null);
                expect(callback.firstCall.args[1]).to.deep.equal({
                    success : true,
                    count : accountsLength
                });
            });
        });
    });

    describe("internal.top", function() {
        var clock, query;

        beforeEach(function() {
            clock = sinon.useFakeTimers();
            Accounts.__set__('setImmediate', setImmediate);
            query = {
                offset : 1,
                limit : 10
            };

            sinon.stub(account, "getAccounts");
        });

        afterEach(function() {
            clock.restore();
            Accounts.__set__('setImmediate', setImmediate);
        });

        it("getAccounts returns error", function() {
            var error = "error";
            account.getAccounts.callsArgWith(1, error);

            account.internal.top(query, callback);

            expect(account.getAccounts.calledOnce).to.be.true;
            expect(account.getAccounts.firstCall.args.length).to.equal(2);
            expect(account.getAccounts.firstCall.args[0]).to.deep.equal({
                sort: {
                    balance: -1
                },
                offset: query.offset,
                limit: query.limit 
            });
            expect(account.getAccounts.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(1);
            expect(callback.firstCall.args[0]).to.equal(error);
        });

        it("success", function() {
            account.getAccounts.callsArgWith(1, null, [testAccount]);

            account.internal.top(query, callback);

            expect(account.getAccounts.calledOnce).to.be.true;
            expect(account.getAccounts.firstCall.args.length).to.equal(2);
            expect(account.getAccounts.firstCall.args[0]).to.deep.equal({
                sort: {
                    balance: -1
                },
                offset: query.offset,
                limit: query.limit 
            });
            expect(account.getAccounts.firstCall.args[1]).to.be.a("function");

            clock.tick();
            expect(callback.calledOnce).to.be.true;
            expect(callback.firstCall.args.length).to.equal(2);
            expect(callback.firstCall.args[0]).to.equal(null);
            expect(callback.firstCall.args[1]).to.deep.equal({
                success : true,
                accounts : [{
					address: testAccount.address,
					balance: testAccount.balance,
					publicKey: testAccount.publicKey
				}]
            });
        });
    });

    describe("internal.getAllAccounts", function() {
        it("standard", function() {
            Accounts.__get__("__private").accounts = {};

            account.internal.getAllAccounts(null, callback);

            setImmediate(function() {
                expect(callback.calledOnce).to.be.true;
                expect(callback.firstCall.args.length).to.equal(2);
                expect(callback.firstCall.args[0]).to.equal(null);
                expect(callback.firstCall.args[1]).to.deep.equal({
                    success : true,
                    accounts : Accounts.__get__("__private").accounts
                });
            });
        });

    });
});
