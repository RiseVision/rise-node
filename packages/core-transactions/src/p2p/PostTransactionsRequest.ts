import { Symbols } from '@risevision/core-interfaces';
import {
  BaseProtobufTransportMethod,
  ProtoIdentifier,
  SingleTransportPayload,
} from '@risevision/core-p2p';
import { ConstantsType, IBaseTransaction } from '@risevision/core-types';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { TransactionLogic } from '../TransactionLogic';
import { TransactionsModule } from '../TransactionModule';
// tslint:disable-next-line
export type PostTransactionsRequestDataType = {
  transactions: Array<IBaseTransaction<any> & { relays: number }>;
};

@injectable()
export class PostTransactionsRequest extends BaseProtobufTransportMethod<
  PostTransactionsRequestDataType,
  null,
  null
> {
  public readonly method: 'POST' = 'POST';
  public readonly baseUrl = '/v2/peer/transactions';

  protected readonly protoRequest: ProtoIdentifier<
    PostTransactionsRequestDataType
  > = {
    messageType: 'transportTransactions',
    namespace: 'transactions.transport',
  };

  @inject(Symbols.modules.transactions)
  private txModule: TransactionsModule;

  @inject(Symbols.logic.transaction)
  private txLogic: TransactionLogic;

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  public mergeRequests(
    reqs: Array<SingleTransportPayload<PostTransactionsRequestDataType, null>>
  ) {
    const allTransactions = _.uniqBy(
      reqs.map((r) => r.body.transactions).reduce((a, b) => a.concat(b), []),
      (t) => t.id
    );

    const chunks = Math.ceil(
      allTransactions.length / this.constants.maxTxsPerBlock
    );

    // split requests into chunks of size maxTxsPerBlock
    return new Array(chunks).fill(null).map((unused, idx) => {
      return {
        body: {
          transactions: allTransactions.slice(
            idx * this.constants.maxTxsPerBlock,
            (idx + 1) * this.constants.maxTxsPerBlock
          ),
        },
      };
    });
  }

  public async isRequestExpired(
    req: SingleTransportPayload<PostTransactionsRequestDataType, null>
  ) {
    const ids = req.body.transactions.map((t) => t.id);

    const confirmedIDs = await this.txModule.filterConfirmedIds(ids);

    // If all confirmed then the whole request is expired.
    if (confirmedIDs.length === ids.length) {
      return true;
    }

    return false;
  }

  protected encodeRequest(
    data: PostTransactionsRequestDataType
  ): Promise<Buffer> {
    return super.encodeRequest({
      transactions: data.transactions.map((tx) =>
        this.txLogic.toProtoBuffer(tx)
      ) as any,
    });
  }

  protected async decodeRequest(
    buf: Buffer
  ): Promise<PostTransactionsRequestDataType> {
    const d = await super.decodeRequest(buf);
    return {
      transactions: d.transactions.map((txBuf) =>
        this.txLogic.fromProtoBuffer(txBuf as any)
      ),
    };
  }

  protected async produceResponse(
    request: SingleTransportPayload<PostTransactionsRequestDataType, null>
  ): Promise<null> {
    if (request.body.transactions.length > 0) {
      await this.txModule.processIncomingTransactions(
        request.body.transactions,
        request.requester
      );
    }
    return null;
  }
}
