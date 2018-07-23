import { AppConfig } from '@risevision/core-types';
import { z_schema } from '@risevision/core-utils';
import * as fs from 'fs';
import * as path from 'path';
import { ICoreModule } from './module';

// tslint:disable-next-line no-var-requires
const configSchema = require('../schema/config.json');

// tslint:disable no-console
export function configCreator(configPath: string, modules: Array<ICoreModule<any>>): AppConfig {
  let configData: any = fs.readFileSync(path.resolve(process.cwd(), (configPath || 'config.json')), 'utf8');

  if (!configData.length) {
    console.log('Failed to read config file');
    process.exit(1);
  } else {
    configData = JSON.parse(configData);
  }

  const validator = new z_schema({});
  const schemas   = [{ module: 'main', schema: configSchema.config }]
    .concat(modules.filter((m) => typeof(m.configSchema) !== 'undefined')
      .map((m) => ({ module: m.name, schema: m.configSchema })));

  for (const { module, schema } of schemas) {
    const valid = validator.validate(configData, schema);
    if (!valid) {
      console.log(`Failed to validate config data for module ${module}`, validator.getLastErrors());
      process.exit(1);
    }
  }

  // cycle through modules who has a .afterConfigValidation function to perform afterValidation fixes.
  for (const module of modules) {
    if (typeof(module.afterConfigValidation) === 'function') {
      configData = module.afterConfigValidation(configData);
    }
  }

  return configData;
}
