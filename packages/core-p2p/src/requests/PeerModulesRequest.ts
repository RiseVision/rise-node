import { ICoreModule, LaunchpadSymbols } from '@risevision/core-launchpad';
import * as assert from 'assert';
import { inject, injectable } from 'inversify';
import {
  BaseProtobufTransportMethod,
  ProtoIdentifier,
} from './BaseProtobufTransportMethod';
import { SingleTransportPayload } from './ITransportMethod';

// tslint:disable-next-line
type Output = { modules: Array<{ name: string; version: string }> };

@injectable()
export class PeerModulesRequest extends BaseProtobufTransportMethod<
  null,
  null,
  Output
> {
  public readonly method: 'GET' = 'GET';
  public readonly baseUrl = '/v2/peer/modules';

  protected readonly protoResponse: ProtoIdentifier<Output> = {
    convOptions: { longs: Number },
    messageType: 'modules',
    namespace: 'p2p.modules',
  };

  @inject(LaunchpadSymbols.coremodules)
  private coremodules: Array<ICoreModule<any>>;

  protected async produceResponse(
    request: SingleTransportPayload<null, null>
  ): Promise<Output> {
    const toRet: Output = { modules: [] };
    for (const mod of this.coremodules) {
      assert(mod.name);
      assert(mod.version);
      toRet.modules.push({
        name: mod.name!,
        version: mod.version!,
      });
    }
    return toRet;
  }
}
