// tslint:disable object-literal-sort-keys max-line-length
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import {
  Address,
  IBaseTransaction,
  IIdsHandler,
  Symbols,
} from '@risevision/core-types';
import { expect } from 'chai';
import { RiseV2 } from 'dpos-offline';
import { Container } from 'inversify';
import 'reflect-metadata';
import { TransactionLogic, TXBytes, TXSymbols } from '../../../src';

import { As } from 'type-tagger';
import { toNativeTx } from '../utils/txCrafter';

describe('some real cases', () => {
  let txBytes: TXBytes;
  let idsHandler: IIdsHandler;
  let container: Container;
  before(async () => {
    container = await createContainer([
      'core-transactions',
      'core-helpers',
      'core-crypto',
      'core-blocks',
      'core',
      'core-accounts',
    ]);
  });
  beforeEach(async () => {
    txBytes = container.get(TXSymbols.txBytes);
    idsHandler = container.get(Symbols.helpers.idsHandler);
  });
  const acct = RiseV2.deriveKeypair('meow');

  it('11060395798852656599', () => {
    const tx = RiseV2.txs.createAndSign(
      {
        kind: 'send-v2',
        amount: '1',
        nonce: '1' as string & As<'nonce'>,
        recipient: '1R' as Address,
      },
      acct,
      true
    );

    const nativeTx = toNativeTx(tx);
    expect(txBytes.fullBytes(nativeTx)).deep.eq(RiseV2.txs.bytes(tx));

    expect(idsHandler.calcTxIdFromBytes(txBytes.fullBytes(nativeTx))).deep.eq(
      RiseV2.txs.identifier(tx)
    );

    // const id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));
    //
    // expect(id).eq('13898794826780361617');
  });
});
