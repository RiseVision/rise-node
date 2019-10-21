// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { execSync } from 'child_process';
import { http, https } from 'follow-redirects';
import fs from 'fs';
import { nodeLogsArchive } from './node/logs/archive';
import { DIST_FILE, DOCKER_DIR } from './shared/constants';
import { extractSourceFile } from './shared/fs-ops';
import { debug, log } from './shared/log';
import {
  execCmd,
  execSyncAsUser,
  getDownloadURL,
  getSudoUsername,
  isSudo,
} from './shared/misc';
import {
  IVerbose,
  IVersion,
  verboseOption,
  versionOptions,
} from './shared/options';
import { updateCLI } from './update-cli';

export type TOptions = IVersion &
  IVerbose & {
    localhost?: boolean;
  };

export default leaf({
  commandName: 'download',
  description:
    'Download a release file from GitHub and extracts it in ' +
    'the current directory.',

  options: {
    localhost: option({
      defaultValue: false,
      description: 'Download from localhost:8080',
      nullable: true,
      typeName: 'boolean',
    }),
    // TODO --url (dont update-cli)
    ...versionOptions,
    ...verboseOption,
  },

  async action({ version, verbose, localhost }: TOptions) {
    try {
      await download({ version, localhost, verbose });
      log('Done');
      log('');
      log('You can start RISE Node using:');
      log('  sudo ./rise node install-deps');
      log('  ./rise node start');
      // log('');
      // log('You can start a Docker container using:');
      // log('  ./rise docker build');
      // log('  ./rise docker start');
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
    }
  },
});

// tslint:disable-next-line:cognitive-complexity
export async function download(
  { version, localhost, verbose }: TOptions = {
    localhost: false,
    version: 'latest',
  },
  preserveCLI = false
) {
  const url = process.env.DOWNLOAD_URL
    ? process.env.DOWNLOAD_URL
    : localhost
    ? `http://localhost:8080/${DIST_FILE}`
    : getDownloadURL(DIST_FILE, version);

  if (preserveCLI) {
    // TODO figure out the cause of errors
    try {
      execSyncAsUser('rm -f rise.bak');
    } catch {
      // empty
    }
    try {
      execSyncAsUser('cp rise rise.bak');
    } catch {
      // empty
    }
  }

  debug(url);
  log(`Downloading ${url}`);

  const file = fs.createWriteStream(DIST_FILE);

  // TODO use axios
  // TODO show progress
  await new Promise((resolve, reject) => {
    // use plain http when in DEV mode
    (process.env.DOWNLOAD_URL || localhost ? http : https)
      .get(url, (response) => {
        const { statusCode } = response;
        const isError = ['4', '5'].includes(statusCode.toString()[0]);
        if (isError) {
          reject(new Error(`Status code ${statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlinkSync(DIST_FILE);
        reject(new Error(err.message));
      });
  });

  log('Download completed');

  // fix perms when in sudo
  if (isSudo()) {
    execSync(`chown ${getSudoUsername()} ${DIST_FILE}`);
  }

  // archive the logs from the prev version (if any)
  try {
    nodeLogsArchive({ verbose });
  } catch {
    // pass
  }

  log(`Extracting ${DIST_FILE}`);
  if (fs.existsSync(DOCKER_DIR)) {
    await execCmd(
      'rm',
      ['-Rf', DOCKER_DIR],
      `Couldn't remove the old version in ${DOCKER_DIR}`
    );
  }
  await execCmd('tar', ['-zxf', DIST_FILE], `Couldn't extract ${DIST_FILE}`);

  await extractSourceFile();

  fs.unlinkSync(DIST_FILE);

  if (!preserveCLI) {
    // make sure the CLI is always the latest
    if (!localhost) {
      await updateCLI({ verbose, version });
    }
  } else {
    // TODO figure out the cause of errors
    try {
      execSyncAsUser('rm -f rise');
    } catch {
      // empty
    }
    try {
      execSyncAsUser('mv rise.bak rise');
    } catch {
      // empty}
    }
  }
}
