import {AppConfig} from '@risevision/core-types';

export type APIConfig = AppConfig & {
  api: {
    enabled: boolean
    access: {
      public: boolean
      whiteList: string[]
      restrictedAPIwhiteList: string[]
    }
    options: {
      limits: {
        max: number
        delayMs: number
        delayAfter: number
        windowMs: number
      }
    }
  }
};
