import { inject, injectable } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IPeerLogic } from '../ioc/interfaces/logic';
import { IPeersModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { PeerState } from '../logic/';
import peersSchema from '../schema/peers';
import { AppConfig } from '../types/genericTypes';
import { APIError } from './errors';

@JsonController('/api/peers')
@injectable()
@IoCSymbol(Symbols.api.peers)
export class PeersAPI {
  // Generics
  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  // tslint:disable-next-line member-ordering
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.generic.versionBuild)
  private versionBuild: string;

  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  @ValidateSchema()
  public async getPeers(@SchemaValid(peersSchema.getPeers, { castNumbers: true })
                        @QueryParams() params: any) {
    let peers: IPeerLogic[];
    try {
      peers = await this.peersModule.getByFilter(params);
    } catch (err) {
      throw new APIError('Failed to get peers', 200);
    }
    return {
      peers: peers.map((peer) => peer.object()),
    };
  }

  @Get('/get')
  @ValidateSchema()
  public async getPeer(@SchemaValid(peersSchema.getPeer, { castNumbers: true })
                       @QueryParams() params: { ip: string, port: number }) {
    try {
      const peers = await this.peersModule.getByFilter(params);
      if (peers.length > 0) {
        return { peer: peers[0] };
      } else {
        return Promise.reject(new APIError('Peer not found', 200));
      }
    } catch (err) {
      throw new APIError('Failed to get peers', 200);
    }
  }

  @Get('/count')
  public async count() {
    try {
      const connected    = (await this.peersModule.getByFilter({ state: PeerState.CONNECTED })).length;
      const disconnected = (await this.peersModule.getByFilter({ state: PeerState.DISCONNECTED })).length;
      const banned       = (await this.peersModule.getByFilter({ state: PeerState.BANNED })).length;

      return { connected, disconnected, banned };
    } catch (e) {
      throw new APIError('Failed to get peer count', 200);
    }
  }

  @Get('/version')
  public async version() {
    return {
      build     : this.versionBuild,
      minVersion: this.systemModule.getMinVersion(),
      version   : this.appConfig.version,
    };
  }

}
