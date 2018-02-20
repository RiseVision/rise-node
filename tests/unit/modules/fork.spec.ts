import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { ForkType } from '../../../src/helpers';
import { Symbols } from '../../../src/ioc/symbols';
import { SignedBlockType } from '../../../src/logic';
import { ForkModule } from '../../../src/modules/fork';
import sql from '../../../src/sql/delegates';
import { DbStub, LoggerStub, SocketIOStub } from '../../stubs';
import { createFakeBlock } from '../../utils/blockCrafter';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/fork', () => {

  let instance: ForkModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let block: SignedBlockType;
  let dbStub: DbStub;
  let loggerStub: LoggerStub;
  let socketIOStub: SocketIOStub;

  before(() => {
    container = new Container();

    // Generic
    container.bind(Symbols.generic.db).to(DbStub).inSingletonScope();
    container.bind(Symbols.generic.socketIO).to(SocketIOStub).inSingletonScope();

    // Helpers
    container.bind(Symbols.helpers.logger).to(LoggerStub).inSingletonScope();

    container.bind(Symbols.modules.fork).to(ForkModule);
    block = createFakeBlock();
  });

  beforeEach(() => {
    sandbox      = sinon.sandbox.create();
    instance     = container.get(Symbols.modules.fork);
    dbStub       = container.get(Symbols.generic.db);
    loggerStub   = container.get(Symbols.helpers.logger);
    socketIOStub = container.get(Symbols.generic.socketIO);
    dbStub.reset();
    loggerStub.stubReset();
    socketIOStub.stubReset();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fork', () => {
    beforeEach(() => {
      dbStub.enqueueResponse('none', Promise.resolve());
    });

    it('should call logger.info', async () => {
      await instance.fork(block, ForkType.TX_ALREADY_CONFIRMED);
      expect(loggerStub.stubs.info.calledOnce).to.be.true;
      expect(loggerStub.stubs.info.firstCall.args[0]).to.be.equal('Fork');
      expect(loggerStub.stubs.info.firstCall.args[1]).to.be.deep.equal({
        block   : {
          id           : block.id,
          timestamp    : block.timestamp,
          height       : block.height,
          previousBlock: block.previousBlock,
        },
        cause   : ForkType.TX_ALREADY_CONFIRMED,
        delegate: block.generatorPublicKey,
      });
    });

    it('should call db.none passing the fork object', async () => {
      await instance.fork(block, ForkType.TX_ALREADY_CONFIRMED);
      expect(dbStub.stubs.none.calledOnce).to.be.true;
      expect(dbStub.stubs.none.firstCall.args[0]).to.be.deep.equal(sql.insertFork);
      expect(dbStub.stubs.none.firstCall.args[1]).to.be.deep.equal({
        blockHeight      : block.height,
        blockId          : block.id,
        blockTimestamp   : block.timestamp,
        cause            : ForkType.TX_ALREADY_CONFIRMED,
        delegatePublicKey: block.generatorPublicKey,
        previousBlock    : block.previousBlock,
      });
    });

    it('should call io.sockets.emit', async () => {
      await instance.fork(block, ForkType.TX_ALREADY_CONFIRMED);
      expect(socketIOStub.sockets.emit.calledOnce).to.be.true;
      expect(socketIOStub.sockets.emit.firstCall.args[0]).to.be.deep.equal('delegates/fork');
      expect(socketIOStub.sockets.emit.firstCall.args[1]).to.be.deep.equal({
        blockHeight      : block.height,
        blockId          : block.id,
        blockTimestamp   : block.timestamp,
        cause            : ForkType.TX_ALREADY_CONFIRMED,
        delegatePublicKey: block.generatorPublicKey,
        previousBlock    : block.previousBlock,
      });
    });
  });
});
