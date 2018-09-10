import { IBlocksModule, Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import { BaseProtobufTransportMethod, ProtoIdentifier } from './BaseProtobufTransportMethod';

@injectable()
export class HeightRequest extends BaseProtobufTransportMethod<null, null, { height: number }> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl       = '/v2/peer/height';

  protected readonly protoResponse: ProtoIdentifier<{ height: number }> = {
    messageType: 'height',
    namespace  : 'p2p.type',
  };

  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  protected async produceResponse(payload: null): Promise<{ height: number }> {
    return { height: this.blocksModule.lastBlock.height };
  }
}
