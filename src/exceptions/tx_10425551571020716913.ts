import { ExceptionsList, ExceptionsManager, IExceptionHandler } from '../helpers';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { IBaseTransaction } from '../logic/transactions';
// tslint:disable max-line-length
/**
 * Failed to apply transaction: 10425551571020716913 - Account does not have enough RISE: 9518100838820316713R balance: 0.72736073
 * [ERR] 2017-12-25 17:24:14 | Transaction - {"id":"10425551571020716913","height":194786,"type":0,"timestamp":38889618,"senderPublicKey":"bcbdeb90a958880088465bc0614d8b877214a33284d460a917208730399f4140","senderId":"9518100838820316713R","recipientId":"16045838773850792609R","amount":400000000,"fee":10000000,"signature":"48bb8adfc375378af8b2dc873595905fe910711b93a71ed5548ffcaa39194e7bb470ea15b5398ed016ddc6d37eee7c62c6e67ba627d5037eee76030e7f1bfe0c","signatures":[],"confirmations":null,"asset":{},"blockId":"10423612971567050656"}
 *
 * Affected block was: 194786
 *
 * NOTE: The transaction is correct and the exception is only for "applyUnconfirmed" checkBalance
 */
export default function exceptionTx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, amount: number, balanceKey: 'balance' | 'u_balance', tx: IBaseTransaction<void>) {
      return balanceKey === 'u_balance' &&
        tx.id === '10425551571020716913' &&
        tx.senderPublicKey === 'bcbdeb90a958880088465bc0614d8b877214a33284d460a917208730399f4140' &&
        tx.signature === '48bb8adfc375378af8b2dc873595905fe910711b93a71ed5548ffcaa39194e7bb470ea15b5398ed016ddc6d37eee7c62c6e67ba627d5037eee76030e7f1bfe0c';
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };
  excManager.registerExceptionHandler(
    ExceptionsList.checkBalance,
    'tx_10425551571020716913',
    handler
  );
}
