import { BaseRequest } from './BaseRequest';
import { IBaseTransaction, IBytesTransaction } from '../../logic/transactions';
import { inject, injectable } from 'inversify';
import { Symbols } from '../../ioc/symbols';
import { ITransactionLogic } from '../../ioc/interfaces/logic';

export type PostTransactionsRequestDataType = {transactions: Array<IBaseTransaction<any>>};

// TODO: Use toTransportTransaction when calling a non-protobuf peer
@injectable()
export class PostTransactionsRequest extends BaseRequest<any, PostTransactionsRequestDataType> {
  protected readonly method = 'POST';
  protected readonly supportsProtoBuf = true;

  @inject(Symbols.logic.transaction)
  private txLogic: ITransactionLogic;

  public getRequestOptions() {
    const reqOptions = super.getRequestOptions();
    if (this.isProtoBuf()) {
      const newData = {
        ...reqOptions.data,
        transactions: reqOptions.data.transactions.map((tx) => this.generateBytesTransaction(tx))
      };

      if (this.protoBufHelper.validate(newData, 'transportTransactions')) {
        reqOptions.data = this.protoBufHelper.encode(newData, 'transportTransactions') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
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
