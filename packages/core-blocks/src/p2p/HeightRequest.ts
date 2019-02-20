import {
  BaseProtobufTransportMethod,
  ProtoIdentifier,
} from '@risevision/core-p2p';
import { IBlocksModule, Symbols } from '@risevision/core-types';
import { inject, injectable } from 'inversify';

@injectable()
export class HeightRequest extends BaseProtobufTransportMethod<
  null,
  null,
  { height: number }
> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/height';

  protected readonly protoResponse: ProtoIdentifier<{ height: number }> = {
    messageType: 'height',
    namespace: 'p2p.type',
  };

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  protected async produceResponse(payload: null): Promise<{ height: number }> {
    return { height: this.blocksModule.lastBlock.height };
  }
}
