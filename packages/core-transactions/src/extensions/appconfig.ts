import {AppConfig} from '@risevision/core-types';

export type ExtendedAppConfig = AppConfig & {
  transactions: {
    maxTxsPerQueue: number,
    bundledInterval: number
    expiryInterval: number,
    bundleLimit: number,
  }
};
