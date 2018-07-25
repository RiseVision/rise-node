import { BaseCoreModule } from '@risevision/core-launchpad';

const schema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule {
  public configSchema = schema;
  public constants    = {};

}
