import { ExceptionsList, ExceptionsManager, IExceptionHandler } from '../helpers';
import { IBaseTransaction, VoteTransaction } from '../logic/transactions';
import { VoteAsset } from '../logic/transactions';
/**
 * This transaction was broadcasted with 14572759844663166621 in the same
 * block and it was not allowed to be included as it removes a vote that
 * was already removed in 14572759844663166621.
 *
 * Affected block was: 441720
 */
export default function exceptionTx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<VoteTransaction> = {
    canHandle(obj: VoteTransaction, tx: IBaseTransaction<VoteAsset>) {
      return tx.id === '14712341342146176146' &&
        tx.senderPublicKey === '505a860f782db11937a1183732770878c45215567856670a9219c27ada80f22e' &&
        // tslint:disable-next-line
        tx.signature === '75ded480d00179b80ae975d91189c2d68fb474b95cd09c1769b2ea693eaa0e502bffe958c8c8bed39b025926b4e7e6ac766f3c82d569a178bc5dd40b7ee2c303';
    },
    handle() {
      return Promise.resolve();
    },
  };
  excManager.registerExceptionHandler(
    ExceptionsList.voteTx_checkUnConfirmedDelegate,
    'tx_14712341342146176146',
    handler
  );
  excManager.registerExceptionHandler(
    ExceptionsList.voteTx_checkConfirmedDelegate,
    'tx_14712341342146176146',
    handler
  );
}
