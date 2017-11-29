import { Controller, Get, QueryParams } from 'ts-express-decorators';
import { PeerState } from '../../logic/';
import peersSchema from '../../schema/peers';
import { PeersModule } from '../peers';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

@Controller('/peers')
class PeersPublicAPI {
  public schema: any;

  constructor(private peersModule: PeersModule) {
    this.schema = this.peersModule.library.schema;
  }

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
      build     : this.peersModule.library.build,
      commit    : this.peersModule.library.lastCommit,
      minVersion: this.peersModule.modules.system.getMinVersion(),
      version   : this.peersModule.library.config.version,
    };
  }

}
