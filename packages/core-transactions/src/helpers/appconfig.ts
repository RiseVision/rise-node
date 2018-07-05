import { AppConfig } from '@risevision/core-types';

export type TXAppConfig = AppConfig & {
  transactions: {
    maxTxsPerQueue: number,
    bundledInterval: number
    expiryInterval: number,
    bundleLimit: number,
  }
};
