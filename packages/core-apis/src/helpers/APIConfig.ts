import {AppConfig} from '@risevision/core-types';

export type APIConfig = AppConfig & {
  api: {
    enabled: boolean
    address?: string
    port: number
    access: {
      public: boolean
      whiteList: string[]
      restrictedWhiteList: string[]
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
