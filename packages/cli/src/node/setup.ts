// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { util } from 'protobufjs';
import { dbInit } from '../db/init';
import { dbAddRepo, dbInstall } from '../db/install';
import { dbStop } from '../db/stop';
import { download } from '../download';
import { VERSION_RISE } from '../shared/constants';
import { handleCLIError } from '../shared/exceptions';
import { killProcessTree } from '../shared/kill';
import { closeLog, debug, log } from '../shared/log';
import {
  checkSudo,
  execSyncAsUser,
  hasLocalPostgres,
  isLinux,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';
import { updateCLI } from '../update-cli';
import { nodeDownloadSnapshot } from './download-snapshot';
import { nodeInstallDeps } from './install-deps';
import { nodeLogsArchive } from './logs/archive';
import { nodeStop } from './stop';
import fs = util.fs;

export type TOptions = IConfig &
  INetwork &
  IVerbose & { noKill?: boolean; noDownload?: boolean };

export default leaf({
  commandName: 'setup',
  description: 'Setup a fresh RISE Node in a single command',

  options: {
    ...configOption,
    ...networkOption,
    ...verboseOption,
    'no-download': option({
      defaultValue: false,
      description: 'Dont download the latest version',
      nullable: true,
      typeName: 'boolean',
    }),
    'no-kill': option({
      defaultValue: false,
      description: 'Dont kill node and postgres processes',
      nullable: true,
      typeName: 'boolean',
    }),
  },

  async action(options: TOptions) {
    try {
      options.noKill = options['no-kill'];
      options.noDownload = options['no-download'];
      await nodeSetup(options);
    } catch (err) {
      debug(err);
      if (options.verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong.' +
          (options.verbose ? '' : ' Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function nodeSetup({
  config,
  network,
  verbose,
  noKill,
  noDownload,
}: TOptions) {
  try {
    // require `sudo`
    checkSudo();

    if (noDownload) {
      execSyncAsUser('tar -xzf source.tar.gz', null, {
        cwd: 'rise-node',
      });
    } else {
      // update
      await download({ verbose }, true);
      await updateCLI({ verbose });
    }

    // handle node_config.json
    config = handleDefaultConfig(config);

    // kill the v1 stuff (optional)
    if (!noKill) {
      await killProcessTree('postgres', verbose);
      await killProcessTree('node', verbose);
    }

    // try to clean things up first
    await stop(verbose, config, network);

    if (isLinux()) {
      dbAddRepo({ verbose });
      await dbInstall({ verbose }, true);
      await nodeInstallDeps({ verbose }, true);
    }
    hasLocalPostgres();

    await dbInit({ config, network, verbose });
    await nodeDownloadSnapshot({ config, network, verbose });

    // archive previous logs
    nodeLogsArchive({ network, config, verbose });

    // start through the shell for a proper PID
    const verboseParam = verbose ? '--verbose' : '';
    const configParam = config ? '--config ' + config : '';
    execSyncAsUser(
      `./rise node start ${configParam} --crontab --network ${network} ${verboseParam}`
    );
  } catch (err) {
    handleCLIError(err);
  }
}

// TODO implement globally
function handleDefaultConfig(config?: string) {
  if (fs.existsSync('node_config.json') && !config) {
    log('Found node_config.json, using it as the default');
    return 'node_config.json';
  }
  return config;
}

async function stop(verbose, config, network) {
  try {
    await nodeStop({ verbose });
  } catch {
    // empty
  }

  try {
    await dbStop({ config, network, verbose });
  } catch {
    // empty
  }
}
