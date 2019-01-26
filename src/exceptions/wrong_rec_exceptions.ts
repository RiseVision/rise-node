import { ExceptionsList, ExceptionsManager, IExceptionHandler } from '../helpers';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { IBaseTransaction } from '../logic/transactions';
import { VoteAsset } from '../logic/transactions';

/**
 * These 2 transactions will not pass as they send data to wrong recipient addresses.
 * Since the 2 transactions are already included in the blockchain we set up the 2 exceptions here.
 */
export default function wrongRecExceptions(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, tx: IBaseTransaction<void>) {
      return (
          // height 501714 - address exceeding uint64
          tx.id === '17611172093035974263' &&
          tx.signature.toString('hex') === 'bb0b08a4bdae675e649c8bea0fff5897aa14c5f77275f81e3cc082fff8e324800a6543cc61fa15905091327b930a4d2fc6a5e7a68e5314cd060148560e985f03'
        ) ||
        (
          // height 241901 - address exceeding uint64
          tx.id === '6132221392997475140' &&
          tx.signature.toString('hex') === '6bdd0c83217230b809893a2b3ca301994398be276ff7858870bebfa63cc5e671fe5c8ecdf53c52a47572958363d7721510d5dbcf49b4aca633df5fc758b1a704'
        );
    },
    handle(obj: ITransactionLogic, tx: IBaseTransaction<void>) {
      const valid = (tx.id === '17611172093035974263' && tx.recipientId === '5R')
      ||
        (tx.id === '6132221392997475140' && tx.recipientId === '49R');
      if (!valid) {
        return Promise.reject(new Error(`Invalid exception transaction ${tx.id}`));
      }
      return Promise.resolve();
    },
  };
  excManager.registerExceptionHandler(
    ExceptionsList.tx_verify,
    'wrong_rec_exceptions',
    handler
  );
  return Promise.resolve();
}
