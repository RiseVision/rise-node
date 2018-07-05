import { ExceptionsList, ExceptionsManager, IExceptionHandler } from '@risevision/core-helpers';
import { ITransactionLogic } from '@risevision/core-interfaces';
import { IBaseTransaction } from '@risevision/core-types';
/**
 * This transaction was broadcasted with 14572759844663166621 in the same
 * block and it was not allowed to be included as it removes a vote that
 * was already removed in 14572759844663166621.
 *
 * The solution here is just to not apply and applyUnconfirmed the tx as the old implementation
 * basically applyUnconfirmed +rollbacl and appy +rollback but newer code broadcasts an error.
 *
 * Affected block was: 441720
 */
export default function exceptionTx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, tx: IBaseTransaction<any>) {
      return tx.id === '14712341342146176146' &&
        tx.senderPublicKey.toString('hex') === '505a860f782db11937a1183732770878c45215567856670a9219c27ada80f22e' &&
        // tslint:disable-next-line
        tx.signature.toString('hex') === '75ded480d00179b80ae975d91189c2d68fb474b95cd09c1769b2ea693eaa0e502bffe958c8c8bed39b025926b4e7e6ac766f3c82d569a178bc5dd40b7ee2c303';
    },
    handle() {
      return Promise.resolve([]);
    },
  };
  excManager.registerExceptionHandler(
    ExceptionsList.tx_apply,
    'tx_14712341342146176146',
    handler
  );
  excManager.registerExceptionHandler(
    ExceptionsList.tx_applyUnconfirmed,
    'tx_14712341342146176146',
    handler
  );
  return Promise.resolve();
}
