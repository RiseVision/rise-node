import { ExceptionsList, ExceptionsManager, IExceptionHandler } from '../helpers';
import { ITransactionLogic } from '../ioc/interfaces/logic';
import { MemAccountsData } from '../logic/';
import { IBaseTransaction} from '../logic/transactions';
/**
 * Failed to apply transaction 1563714189640390961 - Account does not have enough currency: 15844723232461775384R
 * balance: 455.55354484 - 456.06082124 (0.5 diff)
 * Account does not have enough currency: 15844723232461775384R balance: 455.55354484 - 456.06082124
 *
 * Affected block was: 491466
 */
export default function exceptionTx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, amount: number, balanceKey: 'balance'|'u_balance', tx: IBaseTransaction<void>) {
      return tx.id === '1563714189640390961' &&
        tx.senderPublicKey === '0275d0ee6f100cd429bbdc8556e3d1f49cca610f093c2e51e02cf038e8813282' &&
        // tslint:disable-next-line
        tx.signature === '23453a9979ab97b20523acfab3ecd2dd3e9d5decaf6412d34bd9e4da3841ba6f81e6172dd560d113e64184f179b3de2e97d7d62d8daab04271b992b8e4fceb0e';
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };
  excManager.registerExceptionHandler(
    ExceptionsList.checkBalance,
    'tx_1563714189640390961',
    handler
  );
}
