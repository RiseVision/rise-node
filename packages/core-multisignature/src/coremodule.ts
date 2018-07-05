import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants } from './helpers';

export class CoreModule extends BaseCoreModule {
  public configSchema = {};
  public constants    = constants;
}
