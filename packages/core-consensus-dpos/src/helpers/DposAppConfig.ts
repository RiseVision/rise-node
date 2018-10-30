import { AppConfig } from '@risevision/core-types';

export type DposAppConfig = AppConfig & {
  forging: {
    force: boolean
    secret: string[]
    transactionsPolling?: boolean
    pollingInterval?: number
  };
};
