import { inject, injectable } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { IPeersModule, ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import { PeerState } from '../logic/';
import peersSchema from '../schema/peers';
import { AppConfig } from '../types/genericTypes';

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
  @inject(Symbols.generic.lastCommit)
  private lastCommit: string;
  @inject(Symbols.generic.versionBuild)
  private versionBuild: string;

  // Modules
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  @ValidateSchema()
  public async getPeers(@SchemaValid(peersSchema.getPeers)
                        @QueryParams() params: any) {
    try {
      const peers = await this.peersModule.getByFilter(params);
      return { peers };
    } catch (err) {
      throw new Error('Failed to get peers');
    }
  }

  @Get('/get')
  @ValidateSchema()
  public async getPeer(@SchemaValid(peersSchema.getPeer)
                       @QueryParams() params: { ip: string, port: number }) {
    try {
      const peers = await this.peersModule.getByFilter(params);
      if (peers.length > 0) {
        return { peer: peers[0] };
      } else {
        return Promise.reject(new Error('Peer not found'));
      }
    } catch (err) {
      throw new Error('Failed to get peers');
    }
  }

  @Get('/count')
  public async count() {
    try {
      const connected    = await this.peersModule.getByFilter({ state: PeerState.CONNECTED });
      const disconnected = await this.peersModule.getByFilter({ state: PeerState.DISCONNECTED });
      const banned       = await this.peersModule.getByFilter({ state: PeerState.BANNED });

      return { connected, disconnected, banned };
    } catch (e) {
      throw new Error('Failed to get peer count');
    }
  }

  @Get('/version')
  public async version() {
    return {
      build     : this.versionBuild,
      commit    : this.lastCommit,
      minVersion: this.systemModule.getMinVersion(),
      version   : this.appConfig.version,
    };
  }

}
