import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import {SinonSandbox} from 'sinon';
import {Bus} from '../../../src/helpers';

const assertArrays = require('chai-arrays');

const expect = chai.expect;
chai.use(chaiAsPromised);
chai.use(assertArrays);

describe('helpers/bus', () => {
    let sandbox: SinonSandbox;
    let instance: Bus;
    let stub: any;

    beforeEach(() => {
        instance = new Bus();
        sandbox = sinon.sandbox.create();
        stub = sandbox.stub().resolves();
    });

    afterEach(() => {
        sandbox.restore();
        sandbox.reset();
    });

    describe('receiveBlock', () => {
        it('success', () => {
            instance.modules = [{onReceiveBlock: stub}];
            instance.message('receiveBlock', {the: 'block'} as any);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.be.deep.eq({the: 'block'});
        });
    });

    describe('finishRound', () => {
        it('success', () => {
            instance.modules = [{onFinishRound: stub}];
            instance.message('finishRound', 10);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.equal(10);
        });
    });

    describe('transactionsSaved', () => {
        it('success', () => {
            instance.modules = [{onTransactionsSaved: stub}];
            instance.message('transactionsSaved', [1, 2, 3] as any);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.be.equalTo([1, 2, 3]);
        });
    });

    describe('blockchainReady', () => {
        it('success', () => {
            instance.modules = [{onBlockchainReady: stub}];
            instance.message('blockchainReady');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('syncStarted', () => {
        it('success', () => {
            instance.modules = [{onSyncStarted: stub}];
            instance.message('syncStarted');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('syncFinished', () => {
        it('success', () => {
            instance.modules = [{onSyncFinished: stub}];
            instance.message('syncFinished');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('peersReady', () => {
        it('success', () => {
            instance.modules = [{onPeersReady: stub}];
            instance.message('peersReady');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('newBlock', () => {
        it('success', () => {
            instance.modules = [{onNewBlock: stub}];
            instance.message('newBlock', {foo: 'bar'} as any, true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.deep.equal({foo: 'bar'});
            expect(stub.args[0][1]).to.be.true;
        });
    });

    describe('signature', () => {
        it('success', () => {
            instance.modules = [{onSignature: stub}];
            instance.message('signature', {transaction: 'foo', signature: 123}, true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.deep.equal({transaction: 'foo', signature: 123});
            expect(stub.args[0][1]).to.be.true;
        });
    });

    describe('unconfirmedTransaction', () => {
        it('success', () => {
            instance.modules = [{onUnconfirmedTransaction: stub}];
            instance.message('unconfirmedTransaction', 'abc', true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.equal('abc');
            expect(stub.args[0][1]).to.be.true;
        });
    });
});
