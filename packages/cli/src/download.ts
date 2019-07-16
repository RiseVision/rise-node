// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import {
  DIST_FILE,
  DOCKER_DIR,
  DOWNLOAD_URL,
  execCmd,
  extractSourceFile,
  isDevEnv,
  log,
  NODE_VERSION,
} from './shared/misc';

export default leaf({
  commandName: 'download',
  description:
    'Download a release file from GitHub and extracts it in ' +
    'the current directory.',

  options: {
    version: option({
      defaultValue: NODE_VERSION,
      description: 'Version number to download, eg v2.0.0',
      nullable: true,
      typeName: 'string',
    }),
  },

  async action({ version }: { version: string }) {
    try {
      await download({ version });
      console.log('Done');
      console.log('');
      console.log('You can start RISE node using:');
      console.log('  ./rise node install-deps');
      console.log('  ./rise node start');
      console.log('');
      console.log('You can start a Docker container using:');
      console.log('  ./rise docker build');
      console.log('  ./rise docker start');
    } catch (e) {
      log(e);
      console.log('\nThere was an error.');
      process.exit(1);
    }
  },
});

async function download({ version }) {
  const url = isDevEnv()
    ? `http://localhost:8080/${DIST_FILE}`
    : DOWNLOAD_URL + version + '/' + DIST_FILE;

  log(url);
  console.log(`Downloading ${url}`);

  const file = fs.createWriteStream(DIST_FILE);

  // TODO show progress
  await new Promise((resolve, reject) => {
    // use plain http when in DEV mode
    (process.env.DEV ? http : https)
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
        reject(err.message);
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
