import { inject, injectable } from 'inversify';
import { BaseProtobufTransportMethod, SingleTransportPayload } from '@risevision/core-p2p';
import { ConstantsType, IBaseTransaction } from '@risevision/core-types';
import Long from 'long';
import { TransactionsModule, TXSymbols } from '@risevision/core-transactions';
import { Symbols } from '@risevision/core-interfaces';

// tslint:disable-next-line
export type GetSignaturesRequestDataType = {
  signatures: Array<{
    transaction: string,
    signatures?: Buffer[],
  }>
};

@injectable()
export class GetSignaturesRequest extends BaseProtobufTransportMethod<null, null, GetSignaturesRequestDataType> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl       = '/v2/peer/signatures';
  public protoResponse          = {
    converters : { longs: String },
    messageType: 'getSignaturesResponse',
    namespace  : 'multisig',
  };

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(TXSymbols.module)
  private transactionsModule: TransactionsModule;

  protected async produceResponse(request: SingleTransportPayload<null, null>): Promise<GetSignaturesRequestDataType> {
    const txs: Array<IBaseTransaction<any>> = this.transactionsModule
      .getPendingTransactionList(true);

    const signatures = [];
    for (const tx of txs) {
      if (tx.signatures && tx.signatures.length > 0) {
        signatures.push({
          signatures : tx.signatures.map((sig) => {
            return Buffer.from(sig, 'hex');
          }),
          transaction: Long.fromString(tx.id),
        });
      }
    }

    return { signatures };
  }
}
