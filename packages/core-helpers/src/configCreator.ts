import { AppConfig } from '@risevision/core-types';
import * as fs from 'fs';
import * as path from 'path';
import { constants } from './constants';
import { z_schema as ZSchema } from './z_schema';

// tslint:disable-next-line no-var-requires
const configSchema = require('../schema/config.json');

// tslint:disable no-console
/**
 * Loads config from path
 * @param {string} configPath
 * @returns {Buffer}
 */
export function configCreator(configPath: string): AppConfig {
  let configData: any = fs.readFileSync(path.resolve(process.cwd(), (configPath || 'config.json')), 'utf8');

  if (!configData.length) {
    console.log('Failed to read config file');
    process.exit(1);
  } else {
    configData = JSON.parse(configData);
  }

  const validator = new ZSchema({});
  const valid     = validator.validate(configData, configSchema.config);

  if (!valid) {
    console.log('Failed to validate config data', validator.getLastErrors());
    process.exit(1);
  } else {
    if (configData.forging.force) {
      const index = constants.nethashes.indexOf(configData.nethash);

      if (index !== -1) {
        console.log('Forced forging disabled for nethash', configData.nethash);
        configData.forging.force = false;
      }
    }
    if (typeof configData.forging.transactionsPolling === 'undefined') {
      configData.forging.transactionsPolling = false;
    }
    if (configData.forging.transactionsPolling && typeof configData.forging.pollingInterval === 'undefined') {
      configData.forging.pollingInterval = Math.round(constants.blockTime / 2) * 1000;
    }

    // load modules
    return configData;
  }
}
