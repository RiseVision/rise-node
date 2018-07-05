import { AppConfig } from '@risevision/core-types';

export type P2pConfig = AppConfig & {
  peers: {
    list: Array<{ip: string, port: number}>,
    options: {
      max: number
      delayMs: number
      delayAfter: number
      windowMs: number
    }
  };
};
