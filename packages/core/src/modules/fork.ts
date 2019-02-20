import { ModelSymbols } from '@risevision/core-models';
import {
  ForkType,
  IForkModule,
  IForkStatsModel,
  ILogger,
  SignedBlockType,
  Symbols,
} from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import SocketIO from 'socket.io';

@injectable()
export class ForkModule implements IForkModule {
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  //
  // @inject(ModelSymbols.model)
  // @named(Symbols.models.forkStats)
  // private ForksStatsModel: typeof IForkStatsModel;

  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  public async fork(block: SignedBlockType, cause: ForkType) {
    this.logger.info('Fork', {
      block: {
        height: block.height,
        id: block.id,
        previousBlock: block.previousBlock,
        timestamp: block.timestamp,
      },
      cause,
      generator: block.generatorPublicKey.toString('hex'),
    });

    const fork = {
      blockHeight: block.height,
      blockId: block.id,
      blockTimestamp: block.timestamp,
      cause,
      generatorPublicKey: block.generatorPublicKey,
      previousBlock: block.previousBlock,
    };
    //
    // await this.ForksStatsModel.create(fork);

    this.io.sockets.emit('fork', fork);
  }
}
