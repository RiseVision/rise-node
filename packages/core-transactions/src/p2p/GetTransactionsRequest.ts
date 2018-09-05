import { inject, injectable, named } from 'inversify';
import { IBaseTransaction } from '@risevision/core-types';
import { ITransactionLogic, ITransactionsModel, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseRequest } from '@risevision/core-p2p';

// tslint:disable-next-line
export type GetTransactionsRequestDataType = {
  transactions: Array<IBaseTransaction<any>>
};

@injectable()
export class GetTransactionsRequest extends BaseRequest<GetTransactionsRequestDataType, void> {
  protected readonly method: 'GET' = 'GET';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  protected getBaseUrl() {
    return '/v2/peer/transactions';
  }

  protected decodeProtoBufValidResponse(buf: Buffer) {
    const obj = this.protoBufHelper
      .decode<{transactions: Buffer[]}>(buf, 'transactions.transport', 'transportTransactions');
    return {
      transactions: obj.transactions
        .map((txPBuf) => this.transactionLogic.fromProtoBuffer(txPBuf)),
    };
  }
}
