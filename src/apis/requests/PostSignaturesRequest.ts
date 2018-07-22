import { injectable } from 'inversify';
import * as _ from 'lodash';
import * as Long from 'long';
import { BaseRequest } from './BaseRequest';

// tslint:disable-next-line
export type Signature = { transaction: string, signature: Buffer };
// tslint:disable-next-line
export type PostSignaturesRequestDataType = {
  signatures?: Signature[],
  signature?: Signature
};

@injectable()
export class PostSignaturesRequest extends BaseRequest<any, PostSignaturesRequestDataType> {
  protected readonly method           = 'POST';
  protected readonly supportsProtoBuf = true;

  public getRequestOptions(peerSupportsProto) {
    const reqOptions = super.getRequestOptions(peerSupportsProto);
    if (peerSupportsProto) {
      if (Array.isArray(reqOptions.data.signatures)) {
        reqOptions.data.signatures = reqOptions.data.signatures.map((sig) => {
          sig.transaction = Long.fromString(sig.transaction, true) as any;
          return sig;
        }) as any;
      } else {
        reqOptions.data.signature.transaction = Long.fromString(reqOptions.data.signature.transaction, true) as any;
      }
      if (this.protoBufHelper.validate(reqOptions.data, 'transportSignatures', 'postSignatures')) {
        reqOptions.data = this.protoBufHelper.encode(reqOptions.data, 'transportSignatures', 'postSignatures') as any;
      } else {
        throw new Error('Failed to encode ProtoBuf');
      }
    } else {
      if (Array.isArray(reqOptions.data.signatures)) {
        reqOptions.data.signatures = reqOptions.data.signatures.map((s) => {
          if (typeof s.signature !== 'undefined') {
            s.signature = s.signature.toString('hex') as any;
          }
          return s;
        });
      } else {
        reqOptions.data.signature.signature = reqOptions.data.signature.signature.toString('hex') as any;
      }
    }
    return reqOptions;
  }

  public mergeIntoThis(...objs: this[]): void {
    const allSignatures = [this, ...objs]
      .map((item) => {
        const toRet: Signature[] = [];
        if (Array.isArray(item.options.data.signatures)) {
          toRet.push(...item.options.data.signatures);
        }
        if (item.options.data.signature) {
          toRet.push(item.options.data.signature);
        }
        return toRet;
      })
      .reduce((a, b) => a.concat(b));

    this.options.data.signatures = _.uniqBy(
      allSignatures,
      (item) => `${item.transaction}${item.signature.toString('hex')}`
    );
    this.options.data.signature = null;

  }

  protected getBaseUrl(isProto) {
    return isProto ? '/v2/peer/signatures' : '/peer/signatures';
  }
}
