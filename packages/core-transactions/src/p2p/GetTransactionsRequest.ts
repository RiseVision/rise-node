import {
  BaseProtobufTransportMethod,
  Peer,
  ProtoIdentifier,
  SingleTransportPayload,
} from '@risevision/core-p2p';
import { IBaseTransaction } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import { TxConstantsType } from '../helpers';
import { TransactionPool } from '../TransactionPool';
import { TXBytes } from '../txbytes';
import { TXSymbols } from '../txSymbols';

// tslint:disable-next-line
export type GetTransactionsRequestDataType = {
  transactions: Array<IBaseTransaction<any, bigint>>;
};

@injectable()
export class GetTransactionsRequest extends BaseProtobufTransportMethod<
  null,
  null,
  GetTransactionsRequestDataType
> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/transactions';

  public protoResponse: ProtoIdentifier<GetTransactionsRequestDataType> = {
    messageType: 'transportTransactions',
    namespace: 'transactions.transport',
  };

  public schemaResponse = {
    properties: {
      transactions: {
        type: 'array',
      },
    },
    required: ['transactions'],
    type: 'object',
  };

  @inject(TXSymbols.txBytes)
  private txBytes: TXBytes;

  @inject(TXSymbols.pool)
  private pool: TransactionPool;

  @inject(TXSymbols.constants)
  private txConstants: TxConstantsType;

  protected async produceResponse(
    request: SingleTransportPayload<null, null>
  ): Promise<GetTransactionsRequestDataType> {
    let limit = this.txConstants.maxSharedTxs;

    const unconfirmed = this.pool.unconfirmed.list({ limit }).map((t) => t.tx);
    limit -= unconfirmed.length;

    const pending = this.pool.pending.list({ limit }).map((t) => t.tx);
    limit -= pending.length;

    const ready = this.pool.ready.list({ limit }).map((t) => t.tx);

    return { transactions: unconfirmed.concat(pending).concat(ready) };
  }

  // Necessary to keep types easy to use by consumers.
  protected encodeResponse(
    data: GetTransactionsRequestDataType,
    req: SingleTransportPayload<null, null>
  ): Promise<Buffer> {
    return super.encodeResponse(
      {
        transactions: data.transactions.map((d) => ({
          relays: 3,
          tx: this.txBytes.toBuffer(d),
        })),
      } as any,
      null
    );
  }

  protected async decodeResponse(
    res: Buffer,
    peer: Peer
  ): Promise<GetTransactionsRequestDataType> {
    const superRes: { transactions: Buffer[] } = (await super.decodeResponse(
      res,
      peer
    )) as any;
    return {
      transactions: (superRes.transactions || []).map((d: any) => ({
        ...this.txBytes.fromBuffer(d.tx),
        relays: d.relays,
      })),
    };
  }
}
