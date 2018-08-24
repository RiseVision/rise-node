import { inject, injectable } from 'inversify';
import { ITransactionLogic } from '../../ioc/interfaces/logic';
import { IBlocksModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { IBytesTransaction, ITransportTransaction } from '../../logic/transactions';
import { TransactionsModel } from '../../models';
import { BaseRequest } from './BaseRequest';

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

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  public getResponseData(res) {
    if (this.peerSupportsProtoBuf(res.peer)) {
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

  protected getBaseUrl(isProtoBuf) {
    return isProtoBuf ? '/v2/peer/transactions' : '/peer/transactions';
  }
}
