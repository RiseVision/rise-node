import { BaseRequest, MyConvOptions } from '@risevision/core-p2p';
import { injectable } from 'inversify';
import * as _ from 'lodash';
import * as Long from 'long';

// tslint:disable-next-line
export type Signature = { transaction: string, signature: Buffer, relays: number };
// tslint:disable-next-line
export type PostSignaturesRequestDataType = {
  signatures?: Signature[],
};

@injectable()
export class PostSignaturesRequest extends BaseRequest<any, PostSignaturesRequestDataType> {
  protected readonly method: 'POST'   = 'POST';
  protected readonly supportsProtoBuf = true;
  protected readonly baseUrl          = '/v2/peer/signatures';

  public mergeIntoThis(...objs: this[]): void {
    const allSignatures = [this, ...objs]
      .map((item) => [...item.options.data.signatures])
      .reduce((a, b) => a.concat(b));

    this.options.data.signatures = _.uniqBy(
      allSignatures,
      (item) => `${item.transaction}${item.signature.toString('hex')}`
    );
  }

  protected encodeRequestData(data: PostSignaturesRequestDataType): Buffer {
    return this.protoBufHelper.encode({
      signatures: data.signatures.map((s) => {
        return { ...s, transaction: Long.fromString(s.transaction, true) };
      }),
    }, 'multisig', 'postSignatures');
  }

}
