import { inject, injectable, named } from 'inversify';
import * as _ from 'lodash';
import { BaseRequest } from './BaseRequest';
import { IBaseTransaction, IBytesTransaction, PeerRequestOptions } from '@risevision/core-types';
import {
  IBlocksModule,
  ITransactionLogic,
  ITransactionsModel,
  ITransactionsModule,
  Symbols
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';

// tslint:disable-next-line
export type PostTransactionsRequestDataType = {
  transactions?: Array<IBaseTransaction<any>>,
  transaction?: IBaseTransaction<any>,
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
    let newData;
    if (peerSupportsProto) {
      if (typeof reqOptions.data.transactions !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transactions: reqOptions.data.transactions.map(
            (tx) => this.generateBytesTransaction(tx as IBaseTransaction<any>)
          ),
        };
      } else if (typeof reqOptions.data.transaction !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transaction: this.generateBytesTransaction(reqOptions.data.transaction as IBaseTransaction<any>),
        };
      }
      if (this.protoBufHelper.validate(newData, 'transportTransactions')) {
        reqOptions.data = this.protoBufHelper.encode(newData, 'transportTransactions') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      if (typeof reqOptions.data.transactions !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transactions: reqOptions.data.transactions.map(
            (tx) => this.txModel.toTransportTransaction<any>(tx as IBaseTransaction<any>)
          ),
        };
      } else if (typeof reqOptions.data.transaction !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transaction: this.txModel.toTransportTransaction<any>(reqOptions.data.transaction as IBaseTransaction<any>),
        };
      }
      reqOptions.data = newData;
    }
    return reqOptions;
  }

  public mergeIntoThis(...objs: this[]): void {
    const allTransactions = [this, ...objs]
      .map((item) => {
        const toRet: Array<IBaseTransaction<any>> = [];
        if (Array.isArray(item.options.data.transactions)) {
          toRet.push(...item.options.data.transactions);
        }
        if (item.options.data.transaction) {
          toRet.push(item.options.data.transaction);
        }
        return toRet;
      })
      .reduce((a, b) => a.concat(b));

    this.options.data.transactions = _.uniqBy(
      allTransactions,
      (item) => `${item.id}${item.signature.toString('hex')}`
    );
    this.options.data.transaction = null;
  }

  public async isRequestExpired() {
    const txs = this.options.data.transactions || [this.options.data.transaction];

    const ids = txs.map((tx) => tx.id);

    const confirmedIDs = await this.txModule.filterConfirmedIds(ids);
    if (confirmedIDs.length === txs.length) {
      return true;
    }

    return false;
  }

  public generateBytesTransaction(tx: IBaseTransaction<any> & { relays?: number }): IBytesTransaction {
    return {
      bytes                : this.txLogic.getBytes(tx),
      fee                  : tx.fee,
      hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
      hasSignSignature     : typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
      relays               : Number.isInteger(tx.relays) ? tx.relays : 1,
    };
  }

  protected getBaseUrl(isProto) {
    return isProto ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
