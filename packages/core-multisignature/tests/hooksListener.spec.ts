import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { MultisigSymbols } from '../src/helpers';
import { MultisigHooksListener } from '../src/hooks/hooksListener';
import { MultiSigUtils } from '../src/utils';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { WordPressHookSystem } from 'mangiafuoco';
import { Symbols } from '@risevision/core-interfaces';
import { TxReadyFilter } from '@risevision/core-transactions';
import { IBaseTransaction } from '@risevision/core-types';
import { createRandomTransaction, toBufferedTransaction } from '@risevision/core-transactions/tests/utils/txCrafter';
import { ITransaction } from '../../../node_modules/dpos-offline/dist/es5/trxTypes/BaseTx';
import { AccountsModelWithMultisig } from '../src/models/AccountsModelWithMultisig';
import { ModelSymbols } from '@risevision/core-models';
import { LiskWallet } from 'dpos-offline';

describe('HooksListener', () => {
  let container: Container;
  let instance: MultisigHooksListener;
  let utils: MultiSigUtils;
  let sandbox: SinonSandbox;
  let txReadySpy: SinonSpy;
  let hookSystem: WordPressHookSystem;
  let tx: ITransaction<any>;
  let bufTX: IBaseTransaction<any>;
  let AccountsModel: typeof AccountsModelWithMultisig;
  let sender: AccountsModelWithMultisig;
  beforeEach(async () => {
    sandbox       = sinon.createSandbox();
    container     = await createContainer(['core-multisignature', 'core', 'core-helpers']);
    instance      = container.get(MultisigSymbols.hooksListener);
    hookSystem    = container.get(Symbols.generic.hookSystem);
    utils         = container.get(MultisigSymbols.utils);
    AccountsModel = container.getNamed(ModelSymbols.model, Symbols.models.accounts);
    txReadySpy    = sandbox.spy(utils, 'txMultiSigReady');
    expect(instance).not.undefined;

    tx     = createRandomTransaction();
    bufTX  = toBufferedTransaction(tx);
    sender = new AccountsModel({});

  });

  it('should call txReadyStub', async () => {
    await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender);
    expect(txReadySpy.calledOnce).is.true;
  });

  it('should return true', async () => {
    const account          = new LiskWallet('meow', 'R');
    const account2         = new LiskWallet('meow2', 'R');
    sender.multisignatures = [account.publicKey, account2.publicKey];
    sender.multilifetime   = 24;
    sender.multimin        = 2;
    bufTX.signatures       = [
      account.getSignatureOfTransaction(tx),
      account2.getSignatureOfTransaction(tx)
    ];
    expect(await hookSystem
      .apply_filters(TxReadyFilter.name, true, bufTX, sender)
    )
      .true;

    sender.multimin = 1;
    expect(await hookSystem
      .apply_filters(TxReadyFilter.name, true, bufTX, sender)
    )
      .true;
  });
  it('should return false', async () => {
    const account          = new LiskWallet('meow', 'R');
    const account2         = new LiskWallet('meow2', 'R');
    sender.multisignatures = [account.publicKey, account2.publicKey];
    sender.multilifetime   = 24;
    sender.multimin        = 2;
    bufTX.signatures       = [
      account.getSignatureOfTransaction(tx),
    ];
    expect(await hookSystem.apply_filters(TxReadyFilter.name, true, bufTX, sender))
      .false;

    // should not return true if provided payload is already false.
    bufTX.signatures.push(account2.getSignatureOfTransaction(tx));
    expect(await hookSystem.apply_filters(TxReadyFilter.name,
      true, bufTX, sender))
      .true; // just to make sure tx is now valid
    // Real check ->
    expect(await hookSystem.apply_filters(TxReadyFilter.name,
      false, bufTX, sender))
      .false;
  });

});