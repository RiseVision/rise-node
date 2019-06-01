import { leaf, option } from '@carnesen/cli';
import { exec, execSync } from 'child_process';
import * as path from 'path';
import * as debug from 'debug';
// TODO uncomment for production
// import * as http from 'https';
import * as http from 'http';
import * as fs from 'fs';

const NODE_DIR = 'rise-node';
const NODE_URL = 'https://github.com/RiseVision/rise-node-priv/releases/';
const NODE_FILENAME = 'rise-node.tar.gz';

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
    show_logs: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Stream the console output',
    }),
  },

  async action({ config, network, foreground, show_logs }) {
    if (!checkNodeDirExists() || !checkLernaExists()) {
      return;
    }
    const showLogs = show_logs || foreground;
    const config_path = path.resolve(config);
    // remember the original cwd
    const cwd = process.cwd()
    let ready = false;

    console.log('Stating RISE node...');
    try {
      await new Promise((resolve, reject) => {
        // kill the process after 2 mins
        const timeout = setTimeout(reject.bind(null, 'TIMEOUT'), 2 * MIN);

        process.chdir(path.resolve(__dirname, NODE_DIR));
        const cmd = exec(
          getLernaPath() +
            ' run ' +
            `start:${network} ` +
            '--stream ' +
            '--no-prefix ' +
            '-- ' +
            `-e ${config_path}`
        );

        cmd.stdout.on('data', (data: Buffer) => {
          // output
          if (showLogs) {
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
          if (showLogs) {
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
      if (!ready && !showLogs) {
        console.log('Something went wrong. Examine the log using --show_logs.');
        process.exit(1);
      }
    } catch (e) {
      console.log('Error while running the node:');
      console.error(e);
    } finally {
      process.chdir(cwd)
    }
  },
});

function checkNodeDirExists(): boolean {
  if (!fs.existsSync(NODE_DIR) || !fs.lstatSync(NODE_DIR).isDirectory()) {
    console.log(`Error: directory 'rise-node' doesn't exist.`);
    console.log(`You can download the latest version using:`);
    console.log(`  ./rise node download`);
    return false;
  }
  return true;
}

function checkLernaExists(): boolean {
  const file = getLernaPath();
  if (!fs.existsSync(file)) {
    console.log(`Error: can't find lerna exacutable in 'rise-node'.`);
    console.log(`You can download the latest version using:`);
    console.log(`  ./rise node download`);
    return false;
  }
  return true;
}

function getLernaPath(): string {
  return path.resolve(
    path.join(__dirname, NODE_DIR, 'node_modules', '.bin', 'lerna')
  );
}

export const node_download = leaf({
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
    const url = process.env['DEV']
      ? 'http://localhost:8080/rise-node.tar.gz'
      : NODE_URL + version + '/' + NODE_FILENAME;

    console.log(`Downloading ${url}`);

    const file = fs.createWriteStream(NODE_FILENAME);
    // TODO show progress ?
    await new Promise((resolve, reject) => {
      http
        .get(url, function(response) {
          response.pipe(file);
          file.on('finish', function() {
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

    console.log('Download completed');
    console.log('Extracting rise-node.tar.gz');

    execSync(`tar -zxf rise-node.tar.gz`);

    console.log('Done. You can start the node using:');
    console.log('  ./rise node start');
  },
});
