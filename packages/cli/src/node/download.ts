import { leaf, option } from '@carnesen/cli';
import { execSync } from "child_process";
import * as fs from "fs-extra";
import * as http from "http";
import * as https from "https";
import { isDevEnd, NODE_DIR, NODE_FILE, NODE_URL } from '../misc';

export default leaf({
  commandName: 'download',
  description:
    'Download a node release file and extract it to the current directory.',

  options: {
    version: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'latest',
      description: 'Version number to download, eg v2.0.0',
    }),
  },

  async action({ version }) {
    const url = isDevEnd()
      ? 'http://localhost:8080/rise-node.tar.gz'
      : NODE_URL + version + '/' + NODE_FILE;

    console.log(`Downloading ${url}`);

    const file = fs.createWriteStream(NODE_FILE);
    // TODO show progress ?
    await new Promise((resolve, reject) => {
      // use plain http when in DEV mode
      (process.env['DEV'] ? http : https)
        .get(url, function(response) {
          response.pipe(file);
          file.on('finish', function() {
            file.close();
            resolve();
          });
        })
        .on('error', function(err) {
          fs.unlink(NODE_FILE, () => {
            reject(err.message);
          });
        });
    });

    console.log('Download completed');

    console.log(`Removing the old ${NODE_DIR}/ dir`);
    fs.removeSync(NODE_DIR)

    console.log(`Extracting ${NODE_FILE}`);
    execSync(`tar -zxf ${NODE_FILE}`);
    fs.unlinkSync(NODE_FILE);

    console.log('Done\n');
    console.log('\nYou can start the node using:');
    console.log('  ./rise node start');
  },
});
