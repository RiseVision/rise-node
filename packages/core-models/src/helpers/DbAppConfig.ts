import { AppConfig } from '@risevision/core-types';

export type DbAppConfig = AppConfig & {
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    poolSize: number;
    poolIdleTimeout: number;
    reapIntervalMillis: number;
    logEvents: string[];
  };
};
