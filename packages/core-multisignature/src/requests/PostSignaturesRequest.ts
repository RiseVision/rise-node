import { ILogger, Symbols } from '@risevision/core-interfaces';
import { BaseProtobufTransportMethod, BroadcasterLogic, SingleTransportPayload } from '@risevision/core-p2p';
import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import { MultisigSymbols } from '../helpers';
import { MultisignaturesModule } from '../multisignatures';
import { MultisigTransportModule } from '../transport';
import { logOnly } from '@risevision/core-utils';

// tslint:disable-next-line
export type Signature = { transaction: string, signature: Buffer, relays: number };
// tslint:disable-next-line
export type PostSignaturesRequestDataType = {
  signatures?: Signature[],
};

@injectable()
export class PostSignaturesRequest extends BaseProtobufTransportMethod<PostSignaturesRequestDataType, null, null> {
  public readonly batchable: boolean = true;
  public readonly method: 'POST'     = 'POST';
  public readonly baseUrl            = '/v2/peer/signatures';

  // TODO: lerna create schema validation and use this.requestSchema
  // public requestSchema = transportSchema.signatures.properties.signatures

  protected protoRequest = {
    messageType: 'postSignatures',
    namespace  : 'multisig',
  };

  @inject(MultisigSymbols.module)
  private multisigModule: MultisignaturesModule;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(MultisigSymbols.multiSigTransport)
  private multiTransport: MultisigTransportModule;

  public mergeRequests(reqs: Array<SingleTransportPayload<PostSignaturesRequestDataType, null>>): Array<SingleTransportPayload<PostSignaturesRequestDataType, null>> {
    // TODO: implement batching using a constant.
    const allSigs = reqs
      .map((r) => r.body)
      .map((b) => b.signatures)
      .reduce((a, b) => a.concat(b), []);
    return [{
      body: {
        signatures: _.uniqBy(
          allSigs,
          (i) => `${i.transaction}_${i.signature.toString('hex')}`
        ),
      },
    }];
  }

  protected async produceResponse(request: SingleTransportPayload<PostSignaturesRequestDataType, null>): Promise<null> {
    const { body }                = request;
    const signatures: Signature[] = body.signatures;
    for (const sigEl of signatures) {
      try {
        const tx = {
          signature  : sigEl.signature,
          transaction: sigEl.transaction,
        };
        await this.multisigModule.processSignature(tx);
        await this.multiTransport.onSignature(tx, true, this)
          .catch(logOnly(this.logger));
      } catch (e) {
        this.logger.debug('Failed to process multisig signature', e);
      }
    }

    return null;
  }
}
