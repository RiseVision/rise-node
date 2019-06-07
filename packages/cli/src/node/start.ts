import { leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getNodeDir, log, MIN, NETWORKS, NODE_DIR } from '../misc';

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      typeName: 'string',
      nullable: true,
      defaultValue: `${NODE_DIR}/config.json`,
      description: 'Path to the config file',
    }),
    network: option({
      typeName: 'string',
      nullable: true,
      defaultValue: 'mainnet',
      allowedValues: NETWORKS,
    }),
    foreground: option({
      typeName: 'boolean',
      nullable: true,
      defaultValue: false,
      description: 'Keep the process in the foreground. Implies --show_logs',
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
    if (!fs.existsSync(config)) {
      console.log(`ERROR: Config file doesn't exist.\n${config}`);
      return;
    }
    const showLogs = show_logs || foreground;
    const configPath = path.resolve(config);

    console.log('Starting RISE node...');
    try {
      let ready = false;
      await new Promise((resolve, reject) => {
        const cmd =
          getLernaPath() +
          ' run ' +
          `start:${network} ` +
          '--stream ' +
          '--no-prefix ' +
          '-- ' +
          `-e ${configPath}`;
        log('$', cmd);
        // run the command
        const proc = exec(cmd, {
          cwd: getNodeDir(),
          timeout: 2 * MIN,
        });

        function line(data: string) {
          // output
          if (showLogs) {
            process.stdout.write(data);
          } else {
            log(data);
          }
          // check if the output reached the desired line
          if (data.includes('Blockchain ready')) {
            ready = true;
            // keep streaming the output if in the foreground
            if (!foreground) {
              resolve();
            }
          }
        }

        proc.stdout.on('data', line);
        proc.stderr.on('data', line);
        proc.on('close', (code) => {
          log('close', code);
          code ? reject(code) : resolve(code);
        });
      });
      log('done');
      if (!ready) {
        console.log('Something went wrong. Examine the log using --show_logs.');
        process.exit(1);
      }
      console.log('Node started');
    } catch (e) {
      console.log('Something went wrong. Examine the log using --show_logs.');
      console.error(e);
      process.exit(1);
    }
  },
});

function checkNodeDirExists(): boolean {
  if (!fs.existsSync(NODE_DIR) || !fs.lstatSync(NODE_DIR).isDirectory()) {
    console.log(`Error: directory '${NODE_DIR}' doesn't exist.`);
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
