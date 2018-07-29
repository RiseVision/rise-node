import { ExceptionsManager, IExceptionHandler } from '@risevision/core-exceptions';
import { ITransactionLogic } from '@risevision/core-interfaces';
import { TXExceptions } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';

/**
 * Failed to apply transaction 5557619371011868150 - Account does not have enough currency: 15844723232461775384R
 * balance: 312.8466538 - 313.07107077 (0.23)
 *
 * Affected block was: 651118
 */
export default function exceptionTx5557619371011868150(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, amount: number, balanceKey: 'balance'|'u_balance', tx: IBaseTransaction<void>) {
      return tx.id === '5557619371011868150' &&
        tx.senderPublicKey.toString('hex') === '0275d0ee6f100cd429bbdc8556e3d1f49cca610f093c2e51e02cf038e8813282' &&
        // tslint:disable-next-line
        tx.signature.toString('hex') === '74a014e909a532fc07f98ec4afe5f353ef274ac0bcda71308f06acbf434d60b0ff197eb9bb01b4360d34cbbb2e292842c6a6f7792089f58c2f5ea8578a10eb0c';
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };
  excManager.registerExceptionHandler(
    TXExceptions.checkBalance,
    'tx_5557619371011868150',
    handler
  );
  return Promise.resolve();
}
