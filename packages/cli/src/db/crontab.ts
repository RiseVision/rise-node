// tslint:disable:no-console
import { leaf } from '@carnesen/cli';
import path from 'path';
import { POSTGRES_HOME } from '../shared/constants';
import { ConditionsNotMetError, handleCLIError } from '../shared/exceptions';
import { closeLog, debug, log } from '../shared/log';
import {
  execSyncAsUser,
  getCrontab,
  getUsername,
  isLinux,
  isSudo,
} from '../shared/misc';
import {
  configOption,
  IConfig,
  INetwork,
  IVerbose,
  networkOption,
  verboseOption,
} from '../shared/options';

export type TOptions = IVerbose & { removeOnly?: boolean } & INetwork & IConfig;

export default leaf({
  commandName: 'crontab',
  description: 'Manages the DB entry in crontab',

  options: {
    ...configOption,
    ...verboseOption,
    // TODO remove-only
    removeOnly: {
      defaultValue: false,
      description: "Remove old entries, but don't add new ones",
      nullable: true,
      typeName: 'boolean',
    },
    ...networkOption,
  },

  async action({ verbose, config, removeOnly, network }: TOptions) {
    try {
      await dbCrontab({ verbose, config, removeOnly, network });
    } catch (err) {
      debug(err);
      if (verbose) {
        log(err);
      }
      log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    } finally {
      closeLog();
    }
  },
});

export async function dbCrontab({
  verbose,
  config,
  removeOnly,
  network,
}: TOptions) {
  try {
    if (isLinux() && getUsername() !== 'postgres' && !isSudo()) {
      throw new ConditionsNotMetError(
        `Run this command with sudo:\n$ sudo ${getCmd({
          config,
          network,
          removeOnly,
        })}`
      );
    }

    await removeEntries({ verbose });
    if (!removeOnly) {
      await addEntries({ verbose, config, network });
      log('DB entries added to crontab');
    } else {
      log('DB entries removed from crontab');
    }
  } catch (err) {
    handleCLIError(err);
  }
}

async function addEntries({ verbose, config, network }: TOptions) {
  let crontab = await getCrontab(verbose);
  debug('old crontab', crontab);
  const params = [];

  if (network && network !== 'mainnet') {
    params.push(`--network ${network}`);
  }

  if (config) {
    params.push(`--config ${config}`);
  }

  const cmd = `${__filename} db start ${params.join(' ')}`;
  crontab += `@reboot ${cmd} #managed_rise\n`;
  debug('new crontab', crontab);

  execSyncAsUser(
    `echo "${crontab}" | crontab -`,
    isLinux() ? 'postgres' : null,
    { ...getCwd(), env: process.env }
  );
}

// TODO share with /src/node/crontab
async function removeEntries({ verbose }: TOptions) {
  let crontab = await getCrontab(verbose);
  debug('old crontab', crontab);

  crontab = crontab.replace(/^.+#managed_rise\n?/gm, '');
  debug('new crontab', crontab);

  execSyncAsUser(
    `echo "${crontab}" | crontab -`,
    isLinux() ? 'postgres' : null,
    { ...getCwd(), env: process.env }
  );
}

function getCmd({ config, removeOnly, network }: TOptions): string {
  let cmd = './rise db start';
  if (config) {
    cmd += ` --config ${path.resolve(__dirname, config)}`;
  }
  if (network !== 'mainnet') {
    cmd += ` --network ${network}`;
  }
  if (removeOnly) {
    cmd += ' --removeOnly';
  }
  return cmd;
}

function getCwd() {
  return isLinux() ? { cwd: POSTGRES_HOME } : undefined;
}
