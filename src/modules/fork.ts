import { inject, injectable } from 'inversify';
import SocketIO from 'socket.io';
import { ForkType, ILogger } from '../helpers';
import { IForkModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { SignedBlockType } from '../logic';
import { ForksStatsModel } from '../models';

@injectable()
export class ForkModule implements IForkModule {

  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.models.forkStats)
  private ForksStatsModel: typeof ForksStatsModel;
  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  public async fork(block: SignedBlockType, cause: ForkType) {
    this.logger.info('Fork', {
      block   : { id: block.id, timestamp: block.timestamp, height: block.height, previousBlock: block.previousBlock },
      cause,
      delegate: block.generatorPublicKey,
    });

    const fork = {
      blockHeight      : block.height,
      blockId          : block.id,
      blockTimestamp   : block.timestamp,
      cause,
      delegatePublicKey: block.generatorPublicKey,
      previousBlock    : block.previousBlock,
    };

    await this.ForksStatsModel.create(fork);

    this.io.sockets.emit('delegates/fork', fork);
  }
}
