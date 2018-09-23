import { ITransactionPool, Symbols } from '@risevision/core-interfaces';
import { BaseProtobufTransportMethod, SingleTransportPayload } from '@risevision/core-p2p';
import { TXSymbols } from '@risevision/core-transactions';
import { ConstantsType } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

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
  // TODO: Add min and max items for the sign arrays with infos from constants.
  // tslint:disable object-literal-sort-keys
  public readonly responseSchema: any = {
    type      : 'object',
    properties: {
      signatures: {
        type : 'array',
        items: {
          type      : 'object',
          properties: {
            transaction: {
              type  : 'string',
              format: 'txId',
            },
            signatures : {
              type : 'array',
              items: {
                type  : 'object',
                format: 'signatureBuf',
              },
            },
          },
        },
      },
    },
    required  : ['signatures'],
  };
  // tslint:enable object-literal-sort-keys

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(TXSymbols.pool)
  private txPool: ITransactionPool;

  protected async produceResponse(request: SingleTransportPayload<null, null>): Promise<GetSignaturesRequestDataType> {
    const txs = this.txPool.pending.txList({ reverse: true });

    const signatures = [];
    for (const tx of txs) {
      if (tx.signatures && tx.signatures.length > 0) {
        signatures.push({
          signatures : tx.signatures,
          transaction: tx.id,
        });
      }
    }
    return { signatures };
  }
}
