var chai = require("chai");
var expect = chai.expect;
var sinon = require("sinon");
var rewire = require("rewire");
var path = require("path");

var rootDir = path.join(__dirname, "../../../..");

var chainModule = rewire(path.join(rootDir, "modules/blocks/chain"));

describe.only("modules/blocks/chain", function() {
    var sandbox = sinon.sandbox.create({
        injectInto: null,
        properties: ["spy", "stub", "clock"],
        useFakeTimers: true,
        useFakeServer: false
    });

    var library = {
		logger: {
            trace : sandbox.stub()
        },
		db: {},
		genesisblock: {},
		bus: {},
		balancesSequence: {},
		logic: {
			block: {},
			transaction: {},
		},
	};

    var Chain; 

    chainModule.__set__("setImmediate", setImmediate);

    beforeEach(function() {
        Chain = new chainModule(
            library.logger,
            library.logic.block,
            library.logic.transaction,
            library.db,
            library.genesisblock,
            library.bus,
            library.balancesSequence
        );
    });

    afterEach(function() {
        sandbox.reset();
    });

    after(function() {
        sandbox.restore();
        chainModule.__set__("setImmediate", setImmediate);
    });

    describe("constructor", function() {
        it("default", function() {
            expect(library.logger.trace.calledOnce).to.be.true;
        });
    });
});
