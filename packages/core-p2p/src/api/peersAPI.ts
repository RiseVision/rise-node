import { HTTPError } from '@risevision/core-apis';
import {
  AppConfig,
  ISystemModule,
  PeerState,
  Symbols,
} from '@risevision/core-types';
import { IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { p2pSymbols } from '../helpers';
import { PeersModule } from '../peersModule';

// tslint:disable-next-line no-var-requires
const peersSchema = require('../../schema/peers.json');

@JsonController('/api/peers')
@injectable()
@IoCSymbol(p2pSymbols.api.peersAPI)
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
  private peersModule: PeersModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  @Get('/')
  @ValidateSchema()
  public async getPeers(
    @SchemaValid(peersSchema.getPeers, { castNumbers: true })
    @QueryParams()
    params: any
  ) {
    try {
      const peers = this.peersModule.getByFilter(params);
      return { peers: peers.map((peer) => peer.object()) };
    } catch (err) {
      throw new HTTPError('Failed to get peers', 200);
    }
  }

  @Get('/get')
  @ValidateSchema()
  public async getPeer(@SchemaValid(peersSchema.getPeer, { castNumbers: true })
  @QueryParams()
  params: {
    ip: string;
    port: number;
  }) {
    let peers;
    try {
      peers = this.peersModule.getByFilter(params);
    } catch (err) {
      throw new HTTPError('Failed to get peers', 200);
    }
    if (peers.length > 0) {
      return { peer: peers[0] };
    } else {
      throw new HTTPError('Peer not found', 200);
    }
  }

  @Get('/count')
  public count() {
    try {
      const connected = this.peersModule.getByFilter({
        state: PeerState.CONNECTED,
      }).length;
      const disconnected = this.peersModule.getByFilter({
        state: PeerState.DISCONNECTED,
      }).length;
      const banned = this.peersModule.getByFilter({
        state: PeerState.BANNED,
      }).length;

      return { connected, disconnected, banned };
    } catch (e) {
      throw new HTTPError('Failed to get peer count', 200);
    }
  }

  @Get('/version')
  public version() {
    return {
      build: this.versionBuild,
      minVersion: this.systemModule.getMinVersion(),
      version: this.appConfig.version,
    };
  }
}
