// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import path from 'path';
import { getPackagePath } from '../../shared/fs-ops';
import { closeLog, debug, log } from '../../shared/log';
import { mergeConfig } from '../../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IV1,
  IVerbose,
  networkOption,
  v1Option,
  verboseOption,
} from '../../shared/options';

export type TOptions = IConfig & INetwork & IVerbose & IV1;

export default leaf({
  commandName: 'path',
  description: 'Show the path of the log file',
  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    ...v1Option,
  },

  async action({ verbose, network, config, v1 }: TOptions) {
    try {
      log(nodeLogsPath({ network, config, v1 }));
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        "Error when getting the log's file path. " +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export function nodeLogsPath({ network, config, v1 }: TOptions) {
  if (v1 && !config) {
    // TODO extract
    config = 'etc/node_config.json';
  }
  const mergedConfig = mergeConfig(network, config);
  const filename = mergedConfig.logFileName;
  const root = getPackagePath('rise');
  return path.resolve(root, filename);
}
