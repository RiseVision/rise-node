import { inject, injectable, named } from 'inversify';
import { ConstantsType, IBaseTransaction } from '@risevision/core-types';
import { ITransactionLogic, ITransactionsModel, ITransactionsModule, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseProtobufTransportMethod, ProtoIdentifier, SingleTransportPayload } from '@risevision/core-p2p';
import { PostTransactionsRequestDataType } from './PostTransactionsRequest';

// tslint:disable-next-line
export type GetTransactionsRequestDataType = {
  transactions: Array<IBaseTransaction<any>>
};

@injectable()
export class GetTransactionsRequest extends BaseProtobufTransportMethod<null, null, GetTransactionsRequestDataType> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl       = '/v2/peer/transactions';

  public protoResponse: ProtoIdentifier<PostTransactionsRequestDataType> = {
    messageType: 'transportTransactions',
    namespace  : 'transactions.transport',
  };

  @inject(Symbols.logic.transaction)
  private transactionLogic: ITransactionLogic;

  @inject(Symbols.modules.transactions)
  private transactionModule: ITransactionsModule;

  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  // TODO: lerna remove me and use tx type constants.
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  protected async produceResponse(request: SingleTransportPayload<null, null>): Promise<GetTransactionsRequestDataType> {
    const transactions = this.transactionModule.getMergedTransactionList(this.constants.maxSharedTxs);
    return { transactions };
  }

  // Necessary to keep types easy to use by consumers.
  protected encodeResponse(data: GetTransactionsRequestDataType): Promise<Buffer> {
    return super.encodeResponse({
      transactions: data.transactions.map((tx) => this.transactionLogic.toProtoBuffer(tx)),
    } as any);
  }

  protected async decodeResponse(res: Buffer): Promise<GetTransactionsRequestDataType> {
    const superRes: { transactions: Buffer[] } = await super.decodeResponse(res) as any;
    return {
      transactions: superRes.transactions
        .map((bufTx) => this.transactionLogic.fromProtoBuffer(bufTx))
    };
  }
}
