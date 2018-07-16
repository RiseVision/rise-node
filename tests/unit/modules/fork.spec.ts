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
import { LoggerStub, SocketIOStub } from '../../stubs';
import { createFakeBlock } from '../../utils/blockCrafter';
import { createContainer } from '../../utils/containerCreator';
import { ForksStatsModel } from '../../../src/models';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression
describe('modules/fork', () => {

  let instance: ForkModule;
  let container: Container;
  let sandbox: SinonSandbox;
  let block: SignedBlockType;
  let forksModel: typeof ForksStatsModel;
  let loggerStub: LoggerStub;
  let socketIOStub: SocketIOStub;

  beforeEach(() => {
    sandbox      = sinon.createSandbox();
    container = createContainer();
    container.rebind(Symbols.modules.fork).to(ForkModule);
    block = createFakeBlock();
    instance     = container.get(Symbols.modules.fork);
    loggerStub   = container.get(Symbols.helpers.logger);
    socketIOStub = container.get(Symbols.generic.socketIO);
    forksModel = container.get(Symbols.models.forkStats);

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('fork', () => {
    it('should call db.none passing the fork object', async () => {
      const stub = sandbox.stub(forksModel, 'create').resolves();
      await instance.fork(block, ForkType.TX_ALREADY_CONFIRMED);
      expect(stub.called).is.true;
      expect(stub.firstCall.args[0]).deep.eq({
          blockHeight      : block.height,
          blockId          : block.id,
          blockTimestamp   : block.timestamp,
          cause            : ForkType.TX_ALREADY_CONFIRMED,
          delegatePublicKey: block.generatorPublicKey,
          previousBlock    : block.previousBlock,
      });
    });

    it('should call io.sockets.emit', async () => {
      const stub = sandbox.stub(forksModel, 'create').resolves();
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
