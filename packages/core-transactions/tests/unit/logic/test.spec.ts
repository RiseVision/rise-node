// tslint:disable object-literal-sort-keys max-line-length
import { IIdsHandler, Symbols } from '@risevision/core-interfaces';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { IBaseTransaction } from '@risevision/core-types';
import { expect } from 'chai';
import { Container } from 'inversify';
import 'reflect-metadata';
import { TransactionLogic, TXBytes, TXSymbols } from '../../../src';

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

  it('13898794826780361617', () => {
    const tx: IBaseTransaction<any> = {
      id: 'aaaaaaaaaaaaaaa',
      type: 0,
      timestamp: 40355030,
      senderPubData: Buffer.from(
        '27c03d4f7bfeb72e55f18ae3f680d7e36d7c7421379fb40277063088c9be5779',
        'hex'
      ),
      senderId: '4678323313036262437R',
      recipientId: '910097905859080079914R',
      amount: 1490000000n,
      fee: 10000000n,
      signatures: [
        Buffer.from(
          '6bdd0c83217230b809893a2b3ca301994398be276ff7858870bebfa63cc5e671fe5c8ecdf53c52a47572958363d7721510d5dbcf49b4aca633df5fc758b1a704',
          'hex'
        ),
      ],
      asset: null,
      version: 0,
    };

    const id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));

    expect(id).eq('13898794826780361617');
  });
  it('4935955596165940946', () => {
    const tx: IBaseTransaction<any> = {
      amount: 33630309776n,
      asset: null,
      fee: 10000000n,
      id: 'aaaaaa',
      recipientId: '6233046836858939892R',
      senderPubData: Buffer.from(
        'bf4809a1a08c9dffbba741f0c7b9f49145602341d5fa306fb3cd592d3e1058b3',
        'hex'
      ),
      signatures: [
        Buffer.from(
          '58f3ccb59fd720a0fd41381b312e17aea1fda1d26f8e3b89bb128ad217737ec4874c095a36069184a9a4113ec96824ede3269df7fbe2e036d6a399cbc6cb8107',
          'hex'
        ),
      ],
      timestamp: 40355001,
      type: 0,
      version: 0,
    };

    const id = idsHandler.calcTxIdFromBytes(txBytes.fullBytes(tx));

    expect(id).eq('4935955596165940946');
  });
});
