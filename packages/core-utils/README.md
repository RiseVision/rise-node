# RISE Node Core: Utils

Various utilities for RISE node core modules

## Overview

The Utils package makes available an assortment of useful utilities for common operations shared among modules such as decorators and object serializers

## Hooks

Rise uses the `mangiafuoco` hooks system to apply side effects across modules. The core utils module exposes some helpful decorators for dealing with those hooks. Hooks can be actions or filters, where actions are triggered when events happen in a system, and filters are triggered when return values wish to be modified or extended.

### Action example

Registering an action

<!-- @codesample actionHook -->

```TypeScript
/**
 * Called After core module has performed all its operation about destroying a block.
 * You can interrupt the process by throwing or rejecting
 */
export const OnDestroyBlock = createAction<
  (block: IBlocksModel, tx?: Transaction) => Promise<void>
>('core/blocks/chain/onDestroyBlock');
```

<!-- @end-codesample -->

Calling action

<!-- @codesample actionHookCall -->

```TypeScript
await this.hookSystem.do_action(
  OnDestroyBlock.name,
  this.blocksModule.lastBlock,
  dbTX
);
```

<!-- @end-codesample -->

Hooking into action

<!-- @codesample actionHookApply -->

```TypeScript
  @OnDestroyBlock()
  public onDestroyBlock(block: SignedAndChainedBlockType) {
    const prev = block.height;

    const dposFeesSwitchHeight = this.riseContants['@risevision/rise']
      .dposFeesSwitchHeight;
    if (dposFeesSwitchHeight === prev || !this.initializedDpos) {
      this.switchDposFees(prev - 1);
    }
    return null;
  }
```

<!-- @end-codesample -->

### Filter example

Registering a filter

<!-- @codesample filterHook -->

```TypeScript
export const FilterAPIGetAccount = createFilter<
  (what: any, account?: IAccountsModel) => Promise<any>
>('core/apis/accounts/account');
```

<!-- @end-codesample -->

Calling filter

<!-- @codesample filterHookCall -->

```TypeScript
const account = await this.hookSystem.apply_filters(
  FilterAPIGetAccount.name,
  {
    address: accData.address,
    balance: `${accData.balance}`,
    unconfirmedBalance: `${accData.u_balance}`,
  },
  accData
);
```

<!-- @end-codesample -->

Hooking into filter

<!-- @codesample filterHookApply -->

```TypeScript
@FilterAPIGetAccount()
public add2ndSignatureToAccount(
  accData: any,
  model: AccountsModelWith2ndSign
) {
  return {
    ...accData,
    secondPublicKey: model.secondPublicKey
      ? model.secondPublicKey.toString('hex')
      : null,
    secondSignature: model.secondSignature,
    unconfirmedSignature: model.u_secondSignature,
  };
}
```

<!-- @end-codesample -->
