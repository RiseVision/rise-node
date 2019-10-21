// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { execSync } from 'child_process';
import { handleCLIError } from '../../shared/exceptions';
import { closeLog, debug, log } from '../../shared/log';
import { checkSudo, isLinux } from '../../shared/misc';
import {
  configOption,
  dbOption,
  IConfig,
  IDB,
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

export type TOptions = IConfig & INetwork & IVerbose & IV1 & IShell & IDB;

export default leaf({
  commandName: 'show',
  description: 'Show the the log file using less',
  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    ...v1Option,
    ...shellOption,
    ...dbOption,
  },

  async action({ verbose, network, config, v1, shell, db }: TOptions) {
    try {
      if (db && !isLinux()) {
        checkSudo();
      }
      const logPath = nodeLogsPath({ network, config, v1, shell, db });
      execSync(`less ${logPath}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      handleCLIError(err, false);
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
