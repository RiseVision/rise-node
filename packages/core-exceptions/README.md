# RISE Node Core: Exceptions Module

Provides exception handling and logging functionality to RISE nodes

## Providers

* `ExceptionsManager`: A Service to register exception handlers and persist them
* `ExceptionModel`: Exception database object

## Examples

To prevent hard forks, the exceptions model provides helpers to handle invalid blocks and transactions while not having to rewrite history. An example of how that's done is below and can be found in the rise module in `exceptions/mainnet`

<!-- @codesample registerException -->

```TypeScript
/**
 * This transaction was broadcasted with 14572759844663166621 in the same
 * block and it was not allowed to be included as it removes a vote that
 * was already removed in 14572759844663166621.
 *
 * The solution here is just to not apply and applyUnconfirmed the tx as the old implementation
 * basically applyUnconfirmed +rollbacl and appy +rollback but newer code broadcasts an error.
 *
 * Affected block was: 441720
 *
 */
function tx14712341342146176146(excManager: ExceptionsManager) {
  const handler: IExceptionHandler<ITransactionLogic> = {
    canHandle(obj: ITransactionLogic, tx: IBaseTransaction<any>) {
      return (
        tx.id === '14712341342146176146' &&
        tx.senderPubData.toString('hex') ===
          '505a860f782db11937a1183732770878c45215567856670a9219c27ada80f22e' &&
        // tslint:disable-next-line
        tx.signatures[0].toString('hex') ===
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
```

<!-- @end-codesample -->
