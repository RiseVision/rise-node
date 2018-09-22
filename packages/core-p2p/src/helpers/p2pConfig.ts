import { AppConfig } from '@risevision/core-types';

export type P2pConfig = AppConfig & {
  peers: {
    trustProxy: boolean
    list: Array<{ip: string, port: number}>,
    access: {
      blackList: string[]
    },
    banTime: number
    options: {
      max: number
      delayMs: number
      delayAfter: number
      windowMs: number
    }
  };
};
