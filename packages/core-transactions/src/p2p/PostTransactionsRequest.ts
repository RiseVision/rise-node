import {
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseRequest } from '@risevision/core-p2p';
import { IBaseTransaction, PeerRequestOptions } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
// tslint:disable-next-line
export type PostTransactionsRequestDataType = {
  transactions?: Array<IBaseTransaction<any>>,
};

@injectable()
export class PostTransactionsRequest extends BaseRequest<any, PostTransactionsRequestDataType> {
  protected readonly method: 'POST' = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private txModel: typeof ITransactionsModel;

  @inject(Symbols.modules.transactions)
  private txModule: ITransactionsModule;

  public getRequestOptions(peerSupportsProto): PeerRequestOptions<PostTransactionsRequestDataType> {
    const reqOptions = super.getRequestOptions(peerSupportsProto);
    reqOptions.data = this.protoBufHelper.encode(
      {
        transactions: reqOptions.data.transactions.map((tx) => this.txLogic.toProtoBuffer(tx))
      },
      'transactions.transport',
      'transportTransactions'
    ) as any;
    return reqOptions;
  }

  public mergeIntoThis(...objs: this[]): void {
    const allTransactions = [this, ...objs]
      .map((item) => {
        const toRet: Array<IBaseTransaction<any>> = [];
        toRet.push(...item.options.data.transactions);
        return toRet;
      })
      .reduce((a, b) => a.concat(b));

    this.options.data.transactions = _.uniqBy(
      allTransactions,
      (item) => `${item.id}${item.signature.toString('hex')}`
    );
  }

  public async isRequestExpired() {
    const txs = this.options.data.transactions;

    const ids = txs.map((tx) => tx.id);

    const confirmedIDs = await this.txModule.filterConfirmedIds(ids);
    if (confirmedIDs.length === txs.length) {
      return true;
    }

    return false;
  }

  protected getBaseUrl() {
    return '/v2/peer/transactions';
  }
}
