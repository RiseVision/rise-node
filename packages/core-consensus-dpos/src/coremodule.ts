import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants } from './helpers';
import { CommanderStatic } from 'commander';
const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule {
  public constants = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('--forceForging', 'Forces forging. Despite consensus');
  }
}
