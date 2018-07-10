import { BaseRequest } from './BaseRequest';
import { IBaseTransaction, IBytesTransaction, ITransportTransaction } from '../../logic/transactions';
import { inject, injectable } from 'inversify';
import { Symbols } from '../../ioc/symbols';
import { ITransactionLogic } from '../../ioc/interfaces/logic';
import { TransactionsModel } from '../../models';
import { IBlocksModule } from '../../ioc/interfaces/modules';
import { PeerRequestOptions } from '../../modules';

export type PostTransactionsRequestDataType = {
  transactions?: Array<IBaseTransaction<any>>,
  transaction?: IBaseTransaction<any>,
};

// TODO: Use toTransportTransaction when calling a non-protobuf peer
@injectable()
export class PostTransactionsRequest extends BaseRequest<any, PostTransactionsRequestDataType> {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  @inject(Symbols.models.transactions)
  private txModel: typeof TransactionsModel;

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  public getRequestOptions(): PeerRequestOptions<PostTransactionsRequestDataType> {
    const reqOptions = super.getRequestOptions();
    let newData;
    if (this.isProtoBuf()) {
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
        // TODO: no "as any"
        reqOptions.data = this.protoBufHelper.encode(newData, 'transportTransactions') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      if (typeof reqOptions.data.transactions !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transactions: reqOptions.data.transactions.map(
            (tx) => this.txModel.toTransportTransaction<any>(tx as IBaseTransaction<any>, this.blocksModule)
          ),
        };
      } else if (typeof reqOptions.data.transaction !== 'undefined') {
        newData = {
          ...reqOptions.data,
          transaction: this.txModel.toTransportTransaction<any>(reqOptions.data.transaction as IBaseTransaction<any>,
            this.blocksModule),
        };
      }
      // TODO: no "as any"
      reqOptions.data = newData as any;
    }
    return reqOptions;
  }

  protected getBaseUrl() {
    return this.isProtoBuf() ? '/v2/peer/transactions' : '/peer/transactions';
  }

  private generateBytesTransaction(tx: IBaseTransaction<any>): IBytesTransaction {
    return {
      bytes                : this.txLogic.getBytes(tx),
      fee                  : tx.fee,
      hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
      hasSignSignature     : typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
    };
  }
}
