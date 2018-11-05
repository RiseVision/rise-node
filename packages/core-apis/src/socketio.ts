import { Symbols } from '@risevision/core-interfaces';
import { IBaseTransaction, SignedBlockType } from '@risevision/core-types';
import { decorate, inject, injectable } from 'inversify';
import {
  OnWPAction,
  WordPressHookSystem,
  WPHooksSubscriber,
} from 'mangiafuoco';
import { Transaction } from 'sequelize';
import * as SocketIO from 'socket.io';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class SocketIOAPI extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(Symbols.generic.socketIO)
  public io: SocketIO.Server;

  @OnWPAction('core/blocks/chain/applyBlock.post')
  public async onNewBlock(
    block: SignedBlockType,
    tx: Transaction,
    broadcast: boolean
  ) {
    // If !broadcast it probably means we're syncing.
    if (broadcast) {
      this.io.sockets.emit('blocks/change', block);
    }
  }

  @OnWPAction('core-transactions/pool/onUnconfirmedTx')
  public async onNewTransaction(tx: IBaseTransaction<any>) {
    this.io.sockets.emit('transactions/change', tx);
  }

  @OnWPAction('pushapi/onNewMessage')
  public async onNewMessageToPush(kind: string, message: any) {
    this.io.sockets.emit(kind, message);
  }
}
