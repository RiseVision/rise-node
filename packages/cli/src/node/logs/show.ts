// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { closeLog, debug, log } from '../../shared/log';
import {
  configOption,
  IConfig,
  INetwork,
  IShell,
  IV1,
  IVerbose,
  networkOption,
  shellOption,
  v1Option,
  verboseOption,
} from '../../shared/options';
import { nodeLogsPath } from './path';

export type TOptions = IConfig & INetwork & IVerbose & IV1 & IShell;

export default leaf({
  commandName: 'show',
  description: 'Show the path of the log file',
  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    ...v1Option,
    ...shellOption,
  },

  async action({ verbose, network, config, v1, shell }: TOptions) {
    try {
      const logPath = nodeLogsPath({ network, config, v1, shell });
      execSync(`less ${logPath}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        'Error when showing the log file using less. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});
