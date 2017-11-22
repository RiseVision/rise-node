import {IConfirmedTransaction} from '../logic/transactions/baseTransactionType';
import {SignedBlockType} from '../logic/block';

export interface IBus {
  message(what: 'finishRound', round: number);

  message(what: 'transactionsSaved', txs: Array<IConfirmedTransaction<any>>);

  message(what: 'blockchainReady');

  message(what: 'newBlock', block: SignedBlockType, broadcast: boolean);

  message(what: 'signature', ob: { transaction: string, signature: any }, broadcast: boolean);

  message(what: 'syncStarted');

  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
