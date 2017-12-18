import { inject, injectable } from 'inversify';
import { IDatabase } from 'pg-promise';
import { ForkType, ILogger } from '../helpers';
import { IForkModule } from '../ioc/interfaces/modules/';
import { Symbols } from '../ioc/symbols';
import { SignedBlockType } from '../logic';
import sql from '../sql/delegates';

@injectable()
export class ForkModule implements IForkModule {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.generic.db)
  private db: IDatabase<any>;
  @inject(Symbols.generic.socketIO)
  private io: SocketIO.Server;

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

    await this.db.none(sql.insertFork, fork);
    this.io.sockets.emit('delegates/fork', fork);
  }
}
