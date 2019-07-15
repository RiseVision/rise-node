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
  NODE_VERSION,
} from './shared/misc';

export default leaf({
  commandName: 'download',
  description:
    'Download a docker release file and extract it to the current directory.\n' +
    'Automatically rebuilds native node modules (optional).',

  options: {
    version: option({
      defaultValue: NODE_VERSION,
      description: 'Version number to download, eg v2.0.0',
      nullable: true,
      typeName: 'string',
    }),
  },

  async action({ version }: { version: string; skip_rebuild: boolean }) {
    const url = isDevEnv()
      ? `http://localhost:8080/${DIST_FILE}`
      : DOWNLOAD_URL + version + '/' + DIST_FILE;

    console.log(`Downloading ${url}`);

    const file = fs.createWriteStream(DIST_FILE);
    // TODO show progress ?
    await new Promise((resolve, reject) => {
      // use plain http when in DEV mode
      (process.env.DEV ? http : https)
        .get(url, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(DIST_FILE, () => {
            reject(err.message);
          });
        });
    });

    console.log('Download completed');

    console.log(`Extracting ${DIST_FILE}`);
    execCmd(
      `rm -Rf ${DOCKER_DIR}`,
      `Couldn't remove the old version in ${DOCKER_DIR}`
    );
    execCmd(`tar -zxf ${DIST_FILE}`, `Couldn't extract ${DIST_FILE}`);

    extractSourceFile();

    await new Promise((resolve) => {
      fs.unlink(DIST_FILE, resolve);
    });

    console.log('Done');
    console.log('');
    console.log('You can start a node using:');
    console.log('  ./rise node install-deps');
    console.log('  ./rise node start');
    console.log('');
    console.log('You can start a container using:');
    console.log('  ./rise docker build');
    console.log('  ./rise docker start');
  },
});
