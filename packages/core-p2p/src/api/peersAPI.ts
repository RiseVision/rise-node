import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { AppConfig, PeerState } from '@risevision/core-types';
import { HTTPError, IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { p2pSymbols } from '../helpers';
import { PeersModule } from '../peersModule';

const peersSchema = require('../../schema/peers.json');

@JsonController('/api/peers')
@injectable()
@IoCSymbol(p2pSymbols.api.peersAPI)
export class PeersAPI {
  // Generics
  // @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  // tslint:disable-next-line member-ordering
  // @inject(Symbols.generic.zschema)
  public schema: z_schema;
  // @inject(Symbols.generic.versionBuild)
  private versionBuild: string;

  // Modules
  // @inject(Symbols.modules.peers)
  private peersModule: PeersModule;
  // @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  @ValidateSchema()
  public async getPeers(@SchemaValid(peersSchema.getPeers, { castNumbers: true })
                        @QueryParams() params: any) {
    try {
      const peers = await this.peersModule.getByFilter(params);
      return { peers: peers.map((peer) => peer.object()) };
    } catch (err) {
      throw new HTTPError('Failed to get peers', 200);
    }
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
        return Promise.reject(new HTTPError('Peer not found', 200));
      }
    } catch (err) {
      throw new HTTPError('Failed to get peers', 200);
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
      throw new HTTPError('Failed to get peer count', 200);
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
