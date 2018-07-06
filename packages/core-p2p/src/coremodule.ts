import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants, P2pConfig } from './helpers';
import { CommanderStatic } from 'commander';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<P2pConfig> {
  public constants    = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('-x, --peers [peers...]', 'peers list')
  }

  public patchConfigWithCLIParams<T extends P2pConfig>(program: CommanderStatic, appConfig: T) {
    if (program.peers) {
      if (typeof (program.peers) === 'string') {
        appConfig.peers.list = program.peers.split(',')
          .map((peer) => {
            const [ip, port] = peer.split(':');
            return { ip, port: port ? parseInt(port, 10) : appConfig.port };
          });
      } else {
        appConfig.peers.list = [];
      }
    }
    return appConfig;
  }

}
