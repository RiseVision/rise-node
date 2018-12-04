import { DelegatesModule, dPoSSymbols } from '@risevision/core-consensus-dpos';
import {
  ExceptionsManager,
  setupExceptionOnInstance,
} from '@risevision/core-exceptions';
import { IExceptionHandler } from '@risevision/core-exceptions';
import { ITransactionLogic } from '@risevision/core-interfaces';
import { TXSymbols } from '@risevision/core-transactions';
import { IBaseTransaction, SignedBlockType } from '@risevision/core-types';
import { Container } from 'inversify';
import { excSymbols } from './symbols';

// tslint:disable max-line-length no-identical-functions
export async function registerExceptions(
  excManager: ExceptionsManager,
  container: Container
) {
  const dm: DelegatesModule = container.get(dPoSSymbols.modules.delegates);
  setupExceptionOnInstance(
    excManager,
    dm,
    'assertValidBlockSlot',
    excSymbols.delegatesModule_assertValidSlot
  );
  await block_127765(excManager);

  const tl: ITransactionLogic = container.get(TXSymbols.logic);
  // Balance exceptions
  setupExceptionOnInstance(
    excManager,
    tl,
    'assertEnoughBalance',
    excSymbols.txlogic_checkBalance
  );
  await tx1563714189640390961(excManager);
  await tx5557619371011868150(excManager);
  await tx10425551571020716913(excManager);

  setupExceptionOnInstance(excManager, tl, 'apply', excSymbols.txlogic_apply);
  setupExceptionOnInstance(
    excManager,
    tl,
    'applyUnconfirmed',
    excSymbols.txlogic_applyUnconfirmed
  );
  await tx14712341342146176146(excManager);
}

function block_127765(excManager: ExceptionsManager) {
  excManager.registerExceptionHandler(
    excSymbols.delegatesModule_assertValidSlot,
    'block_127765',
    {
      canHandle(obj: any /*DelegatesModule*/, signedBlock: SignedBlockType) {
        return signedBlock.height === 127765;
      },
      handle(obj: any /*DelegatesModule*/, signedBlock: SignedBlockType) {
        // tslint:disable-next-line
        if (
          signedBlock.generatorPublicKey.toString('hex') ===
          'c7fc699fa4feabb3709f12c08121ee890ec30ffa379eaa248827a8c4d30bdef7'
        ) {
          return Promise.resolve();
        }
        return Promise.reject(
          "[block_127765] Exception handling error should've been a different generator"
        );
      },
    }
  );
}

/**
 * Failed to apply transaction 1563714189640390961 - Account does not have enough currency: 15844723232461775384R
 * balance: 455.55354484 - 456.06082124 (0.5 diff)
 * Account does not have enough currency: 15844723232461775384R balance: 455.55354484 - 456.06082124
 *
 * Affected block was: 491466
 */
function tx1563714189640390961(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(
      obj: ITransactionLogic,
      amount: number,
      balanceKey: 'balance' | 'u_balance',
      tx: IBaseTransaction<void>
    ) {
      return (
        tx.id === '1563714189640390961' &&
        tx.senderPublicKey.toString('hex') ===
          '0275d0ee6f100cd429bbdc8556e3d1f49cca610f093c2e51e02cf038e8813282' &&
        // tslint:disable-next-line
        tx.signature.toString('hex') ===
          '23453a9979ab97b20523acfab3ecd2dd3e9d5decaf6412d34bd9e4da3841ba6f81e6172dd560d113e64184f179b3de2e97d7d62d8daab04271b992b8e4fceb0e'
      );
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };

  excManager.registerExceptionHandler(
    excSymbols.txlogic_checkBalance,
    'tx_1563714189640390961',
    handler
  );
  return excManager.createOrUpdateDBExceptions([
    {
      address: '15844723232461775384R',
      maxCount: 4, // Will also handle tx 5557619371011868150,
      type: 'account',
    },
  ]);
}

/**
 * Failed to apply transaction 5557619371011868150 - Account does not have enough currency: 15844723232461775384R
 * balance: 312.8466538 - 313.07107077 (0.23)
 *
 * Affected block was: 651118
 */
function tx5557619371011868150(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(
      obj: ITransactionLogic,
      amount: number,
      balanceKey: 'balance' | 'u_balance',
      tx: IBaseTransaction<void>
    ) {
      return (
        tx.id === '5557619371011868150' &&
        tx.senderPublicKey.toString('hex') ===
          '0275d0ee6f100cd429bbdc8556e3d1f49cca610f093c2e51e02cf038e8813282' &&
        // tslint:disable-next-line
        tx.signature.toString('hex') ===
          '74a014e909a532fc07f98ec4afe5f353ef274ac0bcda71308f06acbf434d60b0ff197eb9bb01b4360d34cbbb2e292842c6a6f7792089f58c2f5ea8578a10eb0c'
      );
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };

  excManager.registerExceptionHandler(
    excSymbols.txlogic_checkBalance,
    'tx_5557619371011868150',
    handler
  );
  return Promise.resolve();
}

/**
 * Failed to apply transaction: 10425551571020716913 - Account does not have enough RISE: 9518100838820316713R balance: 0.72736073
 * [ERR] 2017-12-25 17:24:14 | Transaction - {"id":"10425551571020716913","height":194786,"type":0,"timestamp":38889618,"senderPublicKey":"bcbdeb90a958880088465bc0614d8b877214a33284d460a917208730399f4140","senderId":"9518100838820316713R","recipientId":"16045838773850792609R","amount":400000000,"fee":10000000,"signature":"48bb8adfc375378af8b2dc873595905fe910711b93a71ed5548ffcaa39194e7bb470ea15b5398ed016ddc6d37eee7c62c6e67ba627d5037eee76030e7f1bfe0c","signatures":[],"confirmations":null,"asset":{},"blockId":"10423612971567050656"}
 *
 * Affected block was: 194786
 *
 * NOTE: The transaction is correct and the exception is only for "applyUnconfirmed" checkBalance
 */
function tx10425551571020716913(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(
      obj: ITransactionLogic,
      amount: number,
      balanceKey: 'balance' | 'u_balance',
      tx: IBaseTransaction<void>
    ) {
      return (
        tx.id === '10425551571020716913' &&
        tx.senderPublicKey.toString('hex') ===
          'bcbdeb90a958880088465bc0614d8b877214a33284d460a917208730399f4140' &&
        tx.signature.toString('hex') ===
          '48bb8adfc375378af8b2dc873595905fe910711b93a71ed5548ffcaa39194e7bb470ea15b5398ed016ddc6d37eee7c62c6e67ba627d5037eee76030e7f1bfe0c'
      );
    },
    handle() {
      return { error: false, exceeded: false };
    },
  };
  excManager.registerExceptionHandler(
    excSymbols.txlogic_checkBalance,
    'tx_10425551571020716913',
    handler
  );

  return excManager.createOrUpdateDBExceptions([
    {
      address: '9518100838820316713R',
      maxCount: 4,
      type: 'account',
    },
  ]);
}

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
function tx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, tx: IBaseTransaction<any>) {
      return (
        tx.id === '14712341342146176146' &&
        tx.senderPublicKey.toString('hex') ===
          '505a860f782db11937a1183732770878c45215567856670a9219c27ada80f22e' &&
        // tslint:disable-next-line
        tx.signature.toString('hex') ===
          '75ded480d00179b80ae975d91189c2d68fb474b95cd09c1769b2ea693eaa0e502bffe958c8c8bed39b025926b4e7e6ac766f3c82d569a178bc5dd40b7ee2c303'
      );
    },
    handle() {
      return Promise.resolve([]);
    },
  };
  excManager.registerExceptionHandler(
    excSymbols.txlogic_apply,
    'tx_14712341342146176146',
    handler
  );
  excManager.registerExceptionHandler(
    excSymbols.txlogic_applyUnconfirmed,
    'tx_14712341342146176146',
    handler
  );
  return Promise.resolve();
}
