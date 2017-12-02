import { IDatabase } from 'pg-promise';
import sql from '../../sql/delegates';
import { ForkType, ILogger } from '../helpers';
import { IForkModule } from '../ioc/interfaces/modules/';
import { SignedBlockType } from '../logic';

export class ForkModule implements IForkModule {

  constructor(private library: {logger: ILogger, db: IDatabase<any>, io: SocketIO.Server}) {
  }

  /**
   * Inserts a fork into fork_stats table and emits a socket signal with the fork data
   * @param {SignedBlockType} block
   * @param {ForkType} cause
   * @return {Promise<void>}
   */
  public async fork(block: SignedBlockType, cause: ForkType) {
    this.library.logger.info('Fork', {
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

    await this.library.db.none(sql.insertFork, fork);
    this.library.io.sockets.emit('delegates/fork', fork);
  }
}
