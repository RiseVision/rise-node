import { AppConfig } from '@risevision/core-types';

export type TXAppConfig = AppConfig & {
  transactions: {
    maxTxsPerQueue: number;
    processQueueInterval: number;
    bundleLimit: number;
  };
};
