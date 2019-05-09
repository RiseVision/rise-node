import { injectable } from 'inversify';
import { Overwrite } from 'utility-types';
import { MyConvOptions } from '../helpers';
import { Peer } from '../peer';
import { BaseTransportMethod } from './BaseTransportMethod';
import { SingleTransportPayload } from './ITransportMethod';

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

  get isRequestEncodable(): boolean {
    return Boolean(this.protoRequest);
  }

  get isResponseEncodable(): boolean {
    return Boolean(this.protoResponse);
  }

  protected async encodeRequest(
    data: Data | null = null,
    peer: Peer
  ): Promise<Buffer> {
    return this.protoBufHelper.encode(
      data,
      this.protoRequest.namespace,
      this.protoRequest.messageType
    );
  }

  protected async decodeRequest(
    req: Overwrite<SingleTransportPayload<Data, Query>, { body: Buffer }>
  ): Promise<Data> {
    return this.protoBufHelper.decodeToObj(
      req.body,
      this.protoRequest.namespace,
      this.protoRequest.messageType,
      this.protoRequest.convOptions
    );
  }

  protected async decodeResponse(res: Buffer, peer: Peer): Promise<Out> {
    return this.protoBufHelper.decodeToObj(
      res,
      this.protoResponse.namespace,
      this.protoResponse.messageType,
      this.protoResponse.convOptions
    );
  }

  protected async encodeResponse(
    data: Out,
    req: SingleTransportPayload<Data, Query>
  ): Promise<Buffer> {
    return this.protoBufHelper.encode(
      data,
      this.protoResponse.namespace,
      this.protoResponse.messageType
    );
  }
}
