// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { http, https } from 'follow-redirects';
import fs from 'fs';
import { DIST_FILE, DOCKER_DIR, VERSION_RISE } from './shared/constants';
import { extractSourceFile } from './shared/fs-ops';
import { execCmd, getDownloadURL, log } from './shared/misc';
import { IVerbose, verboseOption } from './shared/options';

export type TOptions = { version: string } & IVerbose & { localhost: boolean };

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
    version: option({
      defaultValue: VERSION_RISE,
      description: 'Version number to download, eg v2.0.0 (optional)',
      nullable: true,
      typeName: 'string',
    }),
    ...verboseOption,
  },

  async action({ version, verbose, localhost }: TOptions) {
    try {
      await download({ version, localhost });
      console.log('Done');
      console.log('');
      console.log('You can start RISE node using:');
      console.log('  ./rise node install-deps');
      console.log('  ./rise node start');
      // console.log('');
      // console.log('You can start a Docker container using:');
      // console.log('  ./rise docker build');
      // console.log('  ./rise docker start');
    } catch (err) {
      log(err);
      if (verbose) {
        console.log(err);
      }
      console.log(
        '\nSomething went wrong. ' +
          (verbose ? '' : 'Examine the log using --verbose.')
      );
      process.exit(1);
    }
  },
});

export async function download(
  { version, localhost }: TOptions = { version: VERSION_RISE, localhost: false }
) {
  const url = process.env.DOWNLOAD_URL
    ? process.env.DOWNLOAD_URL
    : localhost
    ? `http://localhost:8080/${DIST_FILE}`
    : getDownloadURL(DIST_FILE, version);

  log(url);
  console.log(`Downloading ${url}`);

  const file = fs.createWriteStream(DIST_FILE);

  // TODO show progress
  // TODO use a decent HTTP client
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

  console.log('Download completed');

  console.log(`Extracting ${DIST_FILE}`);
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
}
