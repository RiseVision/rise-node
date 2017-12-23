// tslint:disable-next-line interface-name
export interface AppConfigDatabase {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  poolSize: number;
  poolIdleTimeout: number;
  reapIntervalMillis: number;
  logEvents: string[];
}

// tslint:disable-next-line interface-name
export interface AppConfig {
  port: number;
  address: string;
  version: string;
  minVersion: string;
  fileLogLevel: string;
  consoleLogLevel: string;
  logFileName: string;
  trustProxy: boolean;
  topAccounts: boolean;
  cacheEnabled: boolean;
  db: AppConfigDatabase;

  redis: {
    host: string,
    port: number,
    db: number,
    password: string;
  };

  api: {
    enabled: boolean;
    access: {
      public: boolean;
      whiteList: string[]
    },
    options: {
      limits: {
        max: number,
        delayMs: number,
        delayAfter: number,
        windowMs: number,
      }
    }
  };

  peers: {
    enabled: boolean;
    list: Array<{
      ip: string,
      port: number
    }>,
    access: {
      blackList: any[];
    },
    options: {
      limits: {
        max: number
        delayMs: number
        delayAfter: number
        windowMs: number
      },
      timeout: number
    }
  };

  broadcasts: {
    broadcastInterval: number
    broadcastLimit: number
    parallelLimit: number
    releaseLimit: number
    relayLimit: number
  };

  transactions: {
    maxTxsPerQueue: number
  };

  forging: {
    force: boolean,
    secret: string[]
    access: {
      whiteList: string[]
    }
  };

  loading: {
    verifyOnLoading: false,
    snapshot?: number,
    loadPerIteration: number,
  };

  ssl: any;

  dapp: any;
  nethash: string;
}

// tslint:disable-next-line interface-name
export interface PeerHeaders {
  os: string;
  version: string;
  port: number;
  height: number;
  nethash: string;
  broadhash: string;
  nonce: string;
}
