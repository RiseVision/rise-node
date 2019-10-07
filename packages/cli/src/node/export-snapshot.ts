// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import { BACKUPS_DIR } from '../shared/constants';
import { removeBackupLock } from '../shared/fs-ops';
import { closeLog, debug, log } from '../shared/log';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';

export type TOptions = IConfig & INetwork & IVerbose;

export default leaf({
  commandName: 'export-snapshot',
  description: `Creates an optimized database snapshot using the provided config and places it in ./${BACKUPS_DIR}.`,

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
  },

  async action({ config, network, verbose }: TOptions) {
    try {
      await nodeExportDB({ config, network, verbose });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        'Error when creating the backup file.' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
    removeBackupLock();
  },
});

export async function nodeExportDB({ config, network, verbose }: TOptions) {
  // TODO call nodeExportDB
  // import the exported file
  // cut to 101 dividable block?
  // export again as a snapshot?
}
