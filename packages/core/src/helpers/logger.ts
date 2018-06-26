// tslint:disable no-console object-literal-sort-keys
import * as CircularJSON from 'circular-json';
import 'colors';
import * as fs from 'fs';
import * as tstrftime from 'strftime';
import * as util from 'util';

const strftime = tstrftime.timezone('+0000');

type logFn = (message?: string, data?: string | any) => void;

export interface ILogger {
  none: logFn;
  trace: logFn;
  debug: logFn;
  log: logFn;
  info: logFn;
  warn: logFn;
  error: logFn;
  fatal: logFn;

  setLevel(lvl: string): void;
}
const startTime = Date.now();
export default (config: any = {}): ILogger => {
  config                 = config || {};
  const exports: ILogger = {} as any;

  config.levels = config.levels || {
    none : 99,
    trace: 0,
    debug: 1,
    log  : 2,
    info : 3,
    warn : 4,
    error: 5,
    fatal: 6,
  };

  config.level_abbr = config.level_abbr || {
    trace: 'trc',
    debug: 'dbg',
    log  : 'log',
    info : 'inf',
    warn : 'WRN',
    error: 'ERR',
    fatal: 'FTL',
  };

  config.filename = config.filename || __dirname + '/logs.log';

  config.errorLevel = config.errorLevel || 'log';

  const logFile = fs.createWriteStream(config.filename, { flags: 'a' });

  exports.setLevel = (errorLevel) => {
    config.errorLevel = errorLevel;
  };

  function snipsecret(data) {
    for (const key in data) {
      if (key.search(/secret/i) > -1) {
        data[key] = 'XXXXXXXXXX';
      }
    }
    return data;
  }

  function computeData(data) {
    if (data && util.isObject(data)) {
      if (data instanceof Error) {
        data = { message: data.message, error: data.stack };
      }
      if (typeof(data.toLogObj) === 'function') {
        return CircularJSON.stringify(snipsecret(data.toLogObj()));
      } else {
        return CircularJSON.stringify(snipsecret(data));
      }

    } else {
      return data;
    }
  }

  Object.keys(config.levels).forEach((name: string) => {
    function log(message, data) {
      if (config.levels[config.errorLevel] > config.levels[name] &&
        (!config.echo || config.levels[config.echo] > config.levels[name])) {
        // DO not process any further if error level does not need to be processed.
        return;
      }
      const elapsed = Date.now() - startTime;
      const logData = {
        data     : null,
        level    : name,
        message  : null,
        symbol   : null,
        timestamp: strftime('%F %T', new Date()),
      };

      logData.message = message;
      logData.data = computeData(data);
      logData.symbol = config.level_abbr[logData.level] ? config.level_abbr[logData.level] : '???';

      if (config.levels[config.errorLevel] <= config.levels[logData.level]) {
        if (logData.data) {
          logFile.write(util.format('[%s] %s | %s - %s\n', logData.symbol, logData.timestamp, logData.message,
            logData.data));
        } else {
          logFile.write(util.format('[%s] %s | %s\n', logData.symbol, logData.timestamp, logData.message));
        }
      }

      if (config.echo && config.levels[config.echo] <= config.levels[logData.level]) {
        if (logData.data) {
          console.log('[' + logData.symbol.bgYellow.black + ']', logData.timestamp.grey, '|', elapsed.toString().cyan, '|', logData.message, '-',
            logData.data);
        } else {
          console.log('[' + logData.symbol.bgYellow.black + ']', logData.timestamp.grey, '|', elapsed.toString().cyan, '|', logData.message);
        }
      }
    }

    exports[name] = log;
  });

  return exports;
};
