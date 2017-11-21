import { IConfirmedTransaction } from '../logic/transactions/baseTransactionType';

export interface IBus {
  message(what: 'finishRound', round: number);
  message(what: 'transactionsSaved', txs: Array<IConfirmedTransaction<any>>);
  message(what: 'blockchainReady');
  message(what: 'syncStarted');
  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
