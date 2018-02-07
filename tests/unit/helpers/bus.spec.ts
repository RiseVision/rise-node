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
    let stub2: any;

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
        it('success', async () => {
            instance.modules = [{onReceiveBlock: stub}];
            await instance.message('receiveBlock', {the: 'block'} as any);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.be.deep.eq({the: 'block'});
        });
    });

    describe('finishRound', () => {
        it('success', async () => {
            instance.modules = [{onFinishRound: stub}];
            await instance.message('finishRound', 10);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.equal(10);
        });
    });

    describe('transactionsSaved', () => {
        it('success', async () => {
            instance.modules = [{onTransactionsSaved: stub}];
            await instance.message('transactionsSaved', [1, 2, 3] as any);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.be.equalTo([1, 2, 3]);
        });
    });

    describe('blockchainReady', () => {
        it('success', async () => {
            instance.modules = [{onBlockchainReady: stub}];
            await instance.message('blockchainReady');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('syncStarted', () => {
        it('success', async () => {
            instance.modules = [{onSyncStarted: stub}];
            await instance.message('syncStarted');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('syncFinished', () => {
        it('success', async () => {
            instance.modules = [{onSyncFinished: stub}];
            await instance.message('syncFinished');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('peersReady', () => {
        it('success', async () => {
            instance.modules = [{onPeersReady: stub}];
            await instance.message('peersReady');
            expect(stub.calledOnce).is.true;
        });
    });

    describe('newBlock', () => {
        it('success', async () => {
            instance.modules = [{onNewBlock: stub}];
            await instance.message('newBlock', {foo: 'bar'} as any, true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.deep.equal({foo: 'bar'});
            expect(stub.args[0][1]).to.be.true;
        });
    });

    describe('signature', () => {
        it('success', async () => {
            instance.modules = [{onSignature: stub}];
            await instance.message('signature', {transaction: 'foo', signature: 123}, true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.deep.equal({transaction: 'foo', signature: 123});
            expect(stub.args[0][1]).to.be.true;
        });
    });

    describe('unconfirmedTransaction', () => {
        it('success', async () => {
            instance.modules = [{onUnconfirmedTransaction: stub}];
            await instance.message('unconfirmedTransaction', 'abc', true);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.equal('abc');
            expect(stub.args[0][1]).to.be.true;
        });
    });

    describe('Testing multiple listeners', () => {
        it('success', async () => {
            stub2 = sandbox.stub().resolves();
            instance.modules = [{onReceiveBlock: stub}, {onReceiveBlock: stub2}];
            await instance.message('receiveBlock', {the: 'block'} as any);
            expect(stub.calledOnce).is.true;
            expect(stub.args[0][0]).to.be.deep.eq({the: 'block'});
            expect(stub2.calledOnce).is.true;
            expect(stub2.args[0][0]).to.be.deep.eq({the: 'block'});
        });
    });
});
