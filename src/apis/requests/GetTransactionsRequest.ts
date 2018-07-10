import { inject, injectable } from 'inversify';
import { BaseRequest } from './BaseRequest';
import { Symbols } from '../../ioc/symbols';
import { ITransactionLogic } from '../../ioc/interfaces/logic';
import { IBlocksModule, ITransactionsModule } from '../../ioc/interfaces/modules';
import { IBytesTransaction, ITransportTransaction } from '../../logic/transactions';
import { TransactionsModel } from '../../models';

export type GetTransactionsRequestDataType = {
  transactions: Array<ITransportTransaction<any>>
};

@injectable()
export class GetTransactionsRequest extends BaseRequest<GetTransactionsRequestDataType, void> {
  protected readonly method = 'GET';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  public getResponseData(res) {
    if (this.isProtoBuf()) {
      const rawRes = this.decodeProtoBufResponse(res, 'transportTransactions');
      if (typeof rawRes.transactions !== 'undefined') {
        rawRes.transactions = rawRes.transactions.map(
          (tx: any) => TransactionsModel.toTransportTransaction(
            this.transactionLogic.fromBytes(tx as IBytesTransaction), this.blocksModule
          )
        );
      }
      return rawRes;
    } else {
      return res.body;
    }
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
