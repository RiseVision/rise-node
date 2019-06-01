import { leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import { resolve } from 'path';
import * as debug from 'debug';
// TODO uncomment for production
// import * as http from 'https';
import * as http from 'http';
import * as fs from 'fs';

const SEC = 1000;
const MIN = 60 * SEC;
const log = debug('manager');

export const node_start = leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'config.json',
      description: 'Path to the config file',
    }),
    network: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'mainnet',
      allowedValues: ['mainnet', 'testnet'],
    }),
    foreground: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Keep the process in the foreground. Implies --showLog',
    }),
    show_log: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Stream the console output',
    }),
  },

  async action({ config, network, foreground, show_log }) {
    // TODO check if in the correct dir
    // TODO check if `./node_modules/.bin/lerna` exists
    const showLog = show_log || foreground;
    const config_path = resolve(config);
    console.log('Stating RISE node...');
    let ready = false;
    try {
      await new Promise((resolve, reject) => {
        // kill the process after 2 mins
        const timeout = setTimeout(reject.bind(null, 'TIMEOUT'), 2 * MIN);

        const cmd = exec(
          './node_modules/.bin/lerna run ' +
            `start:${network} ` +
            '--stream ' +
            '--no-prefix ' +
            '-- ' +
            `-e ${config_path}`
        );

        cmd.stdout.on('data', (data: Buffer) => {
          // output
          if (showLog) {
            process.stdout.write(data);
          } else {
            log(data.toString('utf8'));
          }
          // check if the output reached the desired line
          if (data.includes('Blockchain ready')) {
            clearTimeout(timeout);
            ready = true;
            // keep streaming the output if in foreground
            if (!foreground) {
              resolve();
            }
          }
        });

        cmd.stderr.on('data', (data: Buffer) => {
          // output
          if (showLog) {
            process.stdout.write(data);
          } else {
            log('err', data.toString('utf8'));
          }
        });

        cmd.stderr.on('close', (code) => {
          log('close', code);
          code ? reject(code) : resolve(code);
        });
      });
      log('done');
      if (!ready && !showLog) {
        console.log('Something went wrong. Examine the log using --show_log.');
        process.exit(1);
      }
    } catch (e) {
      console.log('Error while running the node:');
      console.error(e);
      debugger;
    }
  },
});

const NODE_URL = 'https://github.com/RiseVision/rise-node-priv/releases/';
const NODE_FILENAME = 'rise-node.tar.gz';

export const node_download = leaf({
  commandName: 'download',
  description: 'Download a node release file',

  options: {
    version: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'latest',
      description: 'Version number to download, eg v2.0.0',
    }),
  },

  async action({ version }) {
    // TODO uncomment for production
    // const url = NODE_URL + version + '/' + NODE_FILENAME;
    const url = 'http://localhost:8080/rise-node.tar.gz';
    const file = fs.createWriteStream(NODE_FILENAME);
    // TODO console msg with the version being downloaded
    // TODO show progress
    await new Promise((resolve, reject) => {
      http
        .get(url, function(response) {
          response.pipe(file);
          response.on('finish', function() {
            file.close();
            resolve();
          });
        })
        .on('error', function(err) {
          fs.unlink(NODE_FILENAME, () => {
            reject(err.message);
          });
        });
    });
    console.log('Download complete');
    // TODO extract rise-node.tar.gz
  },
});
