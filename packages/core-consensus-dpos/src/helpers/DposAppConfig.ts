import { AppConfig } from '@risevision/core-types';

export type DposAppConfig = AppConfig & {
  forging: {
    force: boolean
    secret: string[]
    access: {
      whiteList: string[]
    }
    transactionsPolling?: boolean
    pollingInterval?: number
  };
};
