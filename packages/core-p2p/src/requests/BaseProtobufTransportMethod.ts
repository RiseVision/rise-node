import { injectable } from 'inversify';
import { BaseTransportMethod } from './BaseTransportMethod';
import { MyConvOptions } from '../helpers';

// tslint:disable-next-line
export type ProtoIdentifier<T> = {
  namespace: string;
  messageType: string;
  convOptions?: MyConvOptions<T>;
};

@injectable()
export class BaseProtobufTransportMethod<
  Data,
  Query,
  Out
> extends BaseTransportMethod<Data, Query, Out> {
  protected readonly protoRequest: ProtoIdentifier<Data>;
  protected readonly protoResponse: ProtoIdentifier<Out>;

  protected async encodeRequest(data: Data | null = null): Promise<Buffer> {
    if (data === null) {
      return null;
    }
    return this.protoBufHelper.encode(
      data,
      this.protoRequest.namespace,
      this.protoRequest.messageType
    );
  }

  protected async decodeRequest(buf: Buffer): Promise<Data> {
    if (buf === null || !this.protoRequest) {
      return null;
    }
    return this.protoBufHelper.decodeToObj(
      buf,
      this.protoRequest.namespace,
      this.protoRequest.messageType,
      this.protoRequest.convOptions
    );
  }

  protected async decodeResponse(res: Buffer): Promise<Out> {
    if (res === null || !this.protoResponse) {
      return null;
    }
    return this.protoBufHelper.decodeToObj(
      res,
      this.protoResponse.namespace,
      this.protoResponse.messageType,
      this.protoResponse.convOptions
    );
  }

  protected async encodeResponse(data: Out): Promise<Buffer> {
    if (data === null) {
      return null;
    }
    return this.protoBufHelper.encode(
      data,
      this.protoResponse.namespace,
      this.protoResponse.messageType
    );
  }
}
