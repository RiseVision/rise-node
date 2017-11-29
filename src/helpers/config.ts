import * as fs from 'fs';
import * as path from 'path';
import configSchema from '../schema/config';
import constants from './constants';
import {z_schema} from './z_schema';
import { AppConfig } from '../types/genericTypes';

// TODO: define return type.
/**
 * Loads config from path
 * @param {string} configPath
 * @returns {Buffer}
 */
export default function config(configPath: string): AppConfig {
  let configData: any = fs.readFileSync(path.resolve(process.cwd(), (configPath || 'config.json')), 'utf8');

  if (!configData.length) {
    console.log('Failed to read config file');
    process.exit(1);
  } else {
    configData = JSON.parse(configData);
  }

  const validator = new z_schema({});
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
    return configData;
  }
}
