import { inject, injectable, named } from 'inversify';
import { BaseRequest } from './BaseRequest';
import { IBytesTransaction, ITransportTransaction } from '@risevision/core-types';
import { ITransactionLogic, ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';

// tslint:disable-next-line
export type GetTransactionsRequestDataType = {
  transactions: Array<ITransportTransaction<any>>
};

@injectable()
export class GetTransactionsRequest extends BaseRequest<GetTransactionsRequestDataType, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportTransactions');
      if (typeof rawRes.transactions !== 'undefined') {
        rawRes.transactions = rawRes.transactions.map(
          (tx: any) => this.TransactionsModel
            .toTransportTransaction(this.transactionLogic.fromBytes(tx))
        );
      }
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getBaseUrl(isProtoBuf) {
    return isProtoBuf ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
