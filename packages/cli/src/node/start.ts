// tslint:disable:no-console
import { leaf, option } from '@carnesen/cli';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  checkLernaExists,
  checkNodeDirExists,
  extractRiseNodeFile,
  getLernaFilePath,
  getNodeDir,
  isDevEnv,
  log,
  MIN,
  NETWORKS,
  NODE_DIR,
  PID_FILE,
} from '../misc';

export default leaf({
  commandName: 'start',
  description: 'Starts the node using the provided config',

  options: {
    config: option({
      defaultValue: `${NODE_DIR}/config.json`,
      description: 'Path to the config file',
      nullable: true,
      typeName: 'string',
    }),
    foreground: option({
      defaultValue: false,
      description: 'Keep the process in the foreground. Implies --show_logs',
      nullable: true,
      typeName: 'boolean',
    }),
    network: option({
      allowedValues: NETWORKS,
      defaultValue: 'mainnet',
      nullable: true,
      typeName: 'string',
    }),
    show_logs: option({
      defaultValue: false,
      description: 'Stream the console output',
      nullable: true,
      typeName: 'boolean',
    }),
  },

  async action({ config, network, foreground, show_logs }) {
    if (!checkNodeDirExists(true)) {
      extractRiseNodeFile();
    }
    if (!checkLernaExists()) {
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
          getLernaFilePath() +
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
          timeout: foreground ? null : 2 * MIN,
        });

        // TODO extract
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

        // save the PID (not in DEV)
        if (!isDevEnv()) {
          fs.writeFileSync(PID_FILE, proc.pid, { encoding: 'utf8' });
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
