import { expect } from 'chai';
import 'chai-as-promised';
import { Container } from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { IPeersModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { BasePeerType, PeerLogic, PeerState } from '../../../src/logic';
import { PeersModule } from '../../../src/modules';
import { BusStub, PeersLogicStub, SystemModuleStub } from '../../stubs';
import DbStub from '../../stubs/helpers/DbStub';
import LoggerStub from '../../stubs/helpers/LoggerStub';
import { createContainer } from '../../utils/containerCreator';
import { createFakePeer, createFakePeers } from '../../utils/fakePeersFactory';
import { PeersModel } from '../../../src/models';

// tslint:disable no-unused-expression
describe('modules/peers', () => {
  let inst: IPeersModule;
  let instR: PeersModule;
  let container: Container;
  let peersLogicStub: PeersLogicStub;
  const appConfig = {
    peers: {
      list: [{ ip: '1.2.3.4', port: 1111 }, { ip: '5.6.7.8', port: 2222 }],
    },
  };
  let sandbox: SinonSandbox;
  beforeEach(() => {
    sandbox                = sinon.createSandbox();
    container = createContainer();
    container.rebind(Symbols.generic.appConfig).toConstantValue(appConfig);
    container.rebind(Symbols.modules.peers).to(PeersModule);
    inst = instR = container.get(Symbols.modules.peers);
    peersLogicStub = container.get(Symbols.logic.peers);
  });
  afterEach(() => {
    sandbox.restore();
  })
  describe('.update', () => {
    beforeEach(() => {
      peersLogicStub.enqueueResponse('upsert', false);
    });
    it('should update peer.state to CONNECTED', () => {
      const p: PeerLogic = {} as any;
      inst.update(p);
      expect(p.state).to.be.eq(PeerState.CONNECTED);
    });
    it('should call peersLogic.upsert with false as insertOnlyParam and updated peer', () => {
      inst.update({} as any);
      expect(peersLogicStub.stubs.upsert.called).is.true;
    });
    it('should return boolean from peersLogic.upsert', () => {
      expect(inst.update({} as any)).to.be.false;
    });
  });

  describe('.remove', () => {
    beforeEach(() => {
      peersLogicStub.enqueueResponse('remove', false);
    });
    it('should avoid removing peer from config and return false', () => {
      expect(inst.remove(appConfig.peers.list[0].ip, appConfig.peers.list[0].port)).is.false;
      expect(peersLogicStub.stubs.remove.called).is.false;
    });
    it('should call peersLogic.remove with peerIP and port.', () => {
      inst.remove('ip', 1111);
      expect(peersLogicStub.stubs.remove.firstCall.args[0]).to.be.deep.eq({
        ip  : 'ip',
        port: 1111,
      });
    });
    it('should return boolean', () => {
      expect(inst.remove('ip', 1111)).is.false;
    });
  });

  describe('.getByFilter', () => {
    const fields = ['ip', 'port', 'state', 'os', 'version', 'broadhash', 'height', 'nonce'];

    it('should call peersLogic.list with false', async () => {
      peersLogicStub.enqueueResponse('list', []);
      await inst.getByFilter({});
      expect(peersLogicStub.stubs.list.called).is.true;
      expect(peersLogicStub.stubs.list.firstCall.args[0]).is.false;
    });

    for (const f of fields) {
      it(`should filter out peer if ${f} is undefined`, async () => {
        const p = createFakePeer();
        p[f]    = undefined;
        peersLogicStub.enqueueResponse('list', [p]);

        const filter = {};
        filter[f]    = undefined;
        const res    = await inst.getByFilter(filter);
        expect(res).to.be.empty;
      });
      it(`should filter out peer if ${f} is != 'value'`, async () => {
        const p = createFakePeer();
        peersLogicStub.enqueueResponse('list', [p]);
        const filter = {};
        filter[f]    = p[f] + 1;
        const res    = await inst.getByFilter(filter);
        expect(res).to.be.empty;
      });
    }

    describe('ordering', () => {
      it('should order peers by height asc', async () => {
        const p1 = createFakePeer({ height: 2 });
        const p2 = createFakePeer({ height: 1 });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'height:asc' });
        expect(res).to.be.deep.eq([p2, p1]);
      });
      it('should order peers by height desc', async () => {
        const p1 = createFakePeer({ height: 2 });
        const p2 = createFakePeer({ height: 1 });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'height:desc' });
        expect(res).to.be.deep.eq([p1, p2]);
      });
      it('should order peers by height asc if not provided sorting mechanism', async () => {
        const p1 = createFakePeer({ height: 2 });
        const p2 = createFakePeer({ height: 1 });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'height' });
        expect(res).to.be.deep.eq([p2, p1]);
      });

      it('should order peers by version asc', async () => {
        const p1 = createFakePeer({ version: '0.1.1' });
        const p2 = createFakePeer({ version: '0.1.0' });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'version:asc' });
        expect(res).to.be.deep.eq([p2, p1]);
      });
      it('should order peers by version desc', async () => {
        const p1 = createFakePeer({ version: '0.1.1' });
        const p2 = createFakePeer({ version: '0.1.0' });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'version:desc' });
        expect(res).to.be.deep.eq([p1, p2]);
      });
      it('should order peers by version asc if not provided sorting mechanism', async () => {
        const p1 = createFakePeer({ version: '0.1.1' });
        const p2 = createFakePeer({ version: '0.1.0' });
        peersLogicStub.enqueueResponse('list', [p1, p2]);
        const res = await inst.getByFilter({ orderBy: 'version' });
        expect(res).to.be.deep.eq([p2, p1]);
      });

      it('should order peers random if not provided', async () => {
        const peers = Array.apply(null, new Array(20))
          .map((id, idx) => createFakePeer({ height: idx }));
        peersLogicStub.enqueueResponse('list', peers);
        expect(await inst.getByFilter({})).to.not.be.deep.eq(peers);
      });
    });

    it('should trim results by using limits param', async () => {
      const peers = Array.apply(null, new Array(20))
        .map((id, idx) => createFakePeer({ height: idx }));
      peersLogicStub.enqueueResponse('list', peers);
      const res = await inst.getByFilter({ limit: 10 });
      expect(res.length).to.be.eq(10);
    });
    it('should offset results by using offset param', async () => {
      const peers = Array.apply(null, new Array(20))
        .map((id, idx) => createFakePeer({ height: idx }));
      peersLogicStub.enqueueResponse('list', peers);
      const res = await inst.getByFilter({ offset: 5, orderBy: 'height:asc' });
      expect(res[0].height).to.be.eq(5);
    });
    it('should offset & trim results by using offset & limit params', async () => {
      const peers = Array.apply(null, new Array(20))
        .map((id, idx) => createFakePeer({ height: idx }));
      peersLogicStub.enqueueResponse('list', peers);
      const res = await inst.getByFilter({ limit: 10, offset: 5, orderBy: 'height:asc' });
      expect(res[0].height).to.be.eq(5);
      expect(res.length).to.be.eq(10);
    });

  });

  describe('.list', () => {
    let s: SinonSandbox;
    let getByFilterStub: SinonStub;
    let firstPeers: BasePeerType[];
    let secondPeers: BasePeerType[];
    before(() => {
      s = sinon.createSandbox();
    });
    beforeEach(() => {
      getByFilterStub = s.stub(inst, 'getByFilter');
      getByFilterStub.onFirstCall().callsFake(() => firstPeers);
      getByFilterStub.onSecondCall().callsFake(() => secondPeers);
    });
    afterEach(() => s.resetHistory());
    after(() => s.restore());

    it('should return consensus number', async () => {
      firstPeers  = [createFakePeer()];
      secondPeers = [];
      peersLogicStub.enqueueResponse('acceptable', firstPeers);
      peersLogicStub.enqueueResponse('acceptable', secondPeers);
      const target = await inst.list({});
      expect(target).to.haveOwnProperty('consensus');
      expect(target.consensus).to.be.a('number');
      expect(target.consensus).to.be.deep.eq(100);
    });
    it('should return peers array', async () => {
      firstPeers  = [createFakePeer()];
      secondPeers = [];
      peersLogicStub.enqueueResponse('acceptable', firstPeers);
      peersLogicStub.enqueueResponse('acceptable', secondPeers);
      const target = await inst.list({});
      expect(target).to.haveOwnProperty('peers');
      expect(target.peers).to.be.an('array');
    });
    it('should not concat unmatchedbroadhash if limit is matching the matching peers length', async () => {
      firstPeers = createFakePeers(10);
      secondPeers = [createFakePeer()];
      peersLogicStub.enqueueResponse('acceptable', firstPeers);
      const t = await inst.list({limit: 10});
      expect(t.peers.length).to.be.eq(10);
      expect(t.peers).to.be.deep.eq(firstPeers);
      expect(peersLogicStub.stubs.acceptable.calledOnce).is.true;
    });
    it('should call getByFilter with broadhash filter', async () => {
      const systemModule     = container.get<SystemModuleStub>(Symbols.modules.system);
      systemModule.broadhash = 'broadhashhh';
      firstPeers             = [createFakePeer()];
      secondPeers            = [];
      peersLogicStub.enqueueResponse('acceptable', firstPeers);
      peersLogicStub.enqueueResponse('acceptable', secondPeers);
      await inst.list({});
      expect(getByFilterStub.called).is.true;
      expect(getByFilterStub.firstCall.args[0]).to.haveOwnProperty('broadhash');
      expect(getByFilterStub.firstCall.args[0].broadhash).to.be.eq(systemModule.broadhash);
    });
    it('should return only acceptable peers by calling peersLogic.acceptable.', async () => {
      firstPeers  = [createFakePeer()];
      secondPeers = [createFakePeer()];
      peersLogicStub.stubs.acceptable.returns([]);
      const res = await inst.list({});
      expect(res.peers).to.be.empty;
    });
    it('should concat unmatched broadhash peers and truncate with limit.', async () => {
      firstPeers  = createFakePeers(5);
      secondPeers = createFakePeers(10).map((item) => {
        item.broadhash = 'unmatched';
        return item;
      });
      peersLogicStub.stubs.acceptable.callsFake((w) => w);
      const res = await inst.list({ limit: 10 });
      expect(res.peers.length).to.be.eq(10);
      expect(res.peers.slice(5, 10)).to.be.deep.eq(secondPeers.slice(0, 5));
      expect(res.peers.slice(0, 5)).to.be.deep.eq(firstPeers);
    });
    describe('consensus', () => {
      it('should return 0 if no acceptable peers', async () => {
        firstPeers = secondPeers = createFakePeers(20);
        peersLogicStub.stubs.acceptable.returns([]);
        const res = await inst.list({ limit: 10 });
        expect(res.consensus).to.be.eq(0);
      });
      it('should return 100 if all matching broadhash', async () => {
        firstPeers  = createFakePeers(20);
        secondPeers = [];
        peersLogicStub.stubs.acceptable.callsFake((w) => w);
        const res = await inst.list({});
        expect(res.consensus).to.be.eq(100);
      });
      it('should return 25 if 25 matched and 100 did not on limit 100', async () => {
        firstPeers  = createFakePeers(25);
        secondPeers = createFakePeers(100);
        peersLogicStub.stubs.acceptable.callsFake((w) => w);
        const res = await inst.list({ limit: 100 });
        expect(res.consensus).to.be.eq(25);
      });
      it('should return 33.33 if 25 matched and 50 did not on limit 100', async () => {
        firstPeers  = createFakePeers(25);
        secondPeers = createFakePeers(50);
        peersLogicStub.stubs.acceptable.callsFake((w) => w);
        const res = await inst.list({ limit: 100 });
        expect(res.consensus).to.be.eq(33.33);
      });
    });
  });

  // NON interface tests

  describe('.cleanup', () => {
    let truncateStub: SinonStub;
    let bulkCreateStub: SinonStub;
    let txStub: SinonStub;
    beforeEach(() => {
      const peersModel = container.get<any>(Symbols.models.peers);
      truncateStub = sandbox.stub(peersModel, 'truncate');
      bulkCreateStub = sandbox.stub(peersModel, 'bulkCreate');
      txStub = sandbox.stub(peersModel.sequelize, 'transaction').callsFake((t) => t('tx'))
    });
    it('should not save anything if no peers known', async () => {
      peersLogicStub.enqueueResponse('list', []);
      await inst.cleanup();
      expect(bulkCreateStub.called).is.false;
      expect(truncateStub.called).is.false;
    });
    it('should save peers to database with single tx after cleaning peers table', async () => {
      const loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      const fakePeers = [createFakePeer(), createFakePeer()];
      peersLogicStub.enqueueResponse('list', fakePeers);
      await inst.cleanup();
      expect(truncateStub.called).is.true;
      expect(bulkCreateStub.called).is.true;
      expect(truncateStub.calledBefore(bulkCreateStub)).is.true;
      expect(bulkCreateStub.firstCall.args[0]).to.be.deep.eq(fakePeers.map((p) => ({...p, broadhash: Buffer.from(p.broadhash, 'hex')})));
      expect(loggerStub.stubs.info.calledOnce).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args.length).to.be.equal(1);
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Peers exported to database');
    });
    it('should NOT throw error if db query was rejected', async () => {
      const loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      bulkCreateStub.rejects(new Error('error'));
      peersLogicStub.enqueueResponse('list', [createFakePeer()]);
      await inst.cleanup();
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('Export peers to database failed');
      expect(loggerStub.stubs.error.firstCall.args[1]).to.be.deep.equal({error: 'error'});
    });

  });

  describe('.onBlockchainReady', () => {
    let pingStub: SinonStub;
    let busStub: BusStub;
    let loggerStub: LoggerStub;
    let oldEnv: string;
    let peersModel: typeof PeersModel;
    let findAllStub: SinonStub;
    beforeEach(() => {
      oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 't';
      pingStub = sinon.stub().returns(Promise.resolve());
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: pingStub});
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: pingStub});
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: pingStub});
      peersLogicStub.enqueueResponse('exists', false);

      loggerStub = container.get<LoggerStub>(Symbols.helpers.logger);
      busStub = container.get<BusStub>(Symbols.helpers.bus);
      peersModel = container.get(Symbols.models.peers);
      findAllStub = sandbox.stub(peersModel, 'findAll').resolves(['fromDb'])
      busStub.enqueueResponse('message', '');
    });
    afterEach(() => {
      process.env.NODE_ENV = oldEnv;
    });

    it('should load peers from db and config and call pingUpdate on all of them', async () => {
      await instR.onBlockchainReady();
      expect(pingStub.callCount).to.be.eq(3);
      expect(peersLogicStub.stubs.create.callCount).to.be.eq(3);
    });
    it('should call broadcast peersReady', async () => {
      await instR.onBlockchainReady();
      expect(busStub.stubs.message.called).is.true;
      expect(busStub.stubs.message.firstCall.args[0]).to.be.eq('peersReady');
    });
    it('should call logger.trace', async () => {
      await instR.onBlockchainReady();
      expect(loggerStub.stubs.trace.callCount).to.be.equal(5);
      expect(loggerStub.stubs.trace.lastCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.lastCall.args[0]).to.be.equal('Peers->dbLoad Peers discovered');
      expect(loggerStub.stubs.trace.lastCall.args[1]).to.be.deep.equal({
        total: 1,
        updated: 1,
      });
    });
    it('should call logger.error if db query was throw error', async () => {
      const error = new Error('errors');
      findAllStub.rejects(error);
      await instR.onBlockchainReady();
      expect(loggerStub.stubs.error.calledOnce).to.be.true;
      expect(loggerStub.stubs.error.firstCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.error.firstCall.args[0]).to.be.equal('Import peers from database failed');
      expect(loggerStub.stubs.error.firstCall.args[1]).to.be.deep.equal({error: error.message});
    });
    it('should not call broadcast peersReady if process.env.NODE_ENV === test', async () => {
      process.env.NODE_ENV = 'test';
      await instR.onBlockchainReady();
      expect(busStub.stubs.message.called).is.false;
    });
    it('should not increase updated if peer fails', async () => {
      peersLogicStub.reset();
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: pingStub});
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: pingStub});
      peersLogicStub.enqueueResponse('create', {pingAndUpdate: () => Promise.reject('booo')});
      peersLogicStub.enqueueResponse('exists', false);
      await instR.onBlockchainReady();
      expect(loggerStub.stubs.info.callCount).to.be.equal(2);
      expect(loggerStub.stubs.info.args[0][0]).to.contains('Peers->insertSeeds - Peers discovered');
      expect(loggerStub.stubs.info.args[1][0]).to.contains('unresponsive');
      expect(loggerStub.stubs.info.callCount).to.be.equal(2);
      expect(loggerStub.stubs.trace.callCount).to.be.equal(5);
      expect(loggerStub.stubs.trace.lastCall.args.length).to.be.equal(2);
      expect(loggerStub.stubs.trace.lastCall.args[0]).to.be.equal('Peers->dbLoad Peers discovered');
      expect(loggerStub.stubs.trace.lastCall.args[1]).to.be.deep.equal({
        total: 1,
        updated: 0,
      });
    });

  });

});
