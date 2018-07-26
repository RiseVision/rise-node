import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants, DposAppConfig } from './helpers';
import { CommanderStatic } from 'commander';
import { AccountsModelForDPOS } from './models/';
import { ModelSymbols, utils } from '@risevision/core-models';
import { Symbols } from '@risevision/core-interfaces';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<DposAppConfig> {
  public constants    = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('--forceForging', 'Forces forging. Despite consensus');
  }

  public initAppElements() {
    utils.mergeModels(
      AccountsModelForDPOS,
      this.container
        .getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }
}
