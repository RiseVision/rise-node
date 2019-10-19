import { option } from '@carnesen/cli';
import { NETWORKS, TNetworkType } from './constants';

// --config

export const configOption = {
  config: option({
    description: 'Path to the config file (optional)',
    nullable: true,
    typeName: 'string',
  }),
};

export interface IConfig {
  config?: string;
}

// --network

export const networkOption = {
  network: option({
    // @ts-ignore
    allowedValues: NETWORKS,
    defaultValue: 'mainnet',
    description: 'Network type (optional)',
    nullable: true,
    typeName: 'string',
  }),
};

export interface INetwork {
  network?: TNetworkType;
}

// --verbose

export const verboseOption = {
  verbose: option({
    defaultValue: false,
    description: 'Show as much information as possible (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IVerbose {
  verbose?: boolean;
}

// --foreground

export const foregroundOption = {
  foreground: option({
    defaultValue: false,
    description:
      'Keep the process in the foreground and stream the output (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IForeground {
  foreground?: boolean;
}

// --v1

export const v1Option = {
  v1: option({
    defaultValue: false,
    description: 'Use the V1 config and DB (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IV1 {
  v1?: boolean;
}

// --shell

export const shellOption = {
  shell: option({
    defaultValue: false,
    description: 'Show the shell log (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IShell {
  shell?: boolean;
}

// --db

export const dbOption = {
  db: option({
    defaultValue: false,
    description: 'Show the DB log (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IDB {
  db?: boolean;
}

// --crontab

export const crontabOption = {
  crontab: option({
    defaultValue: false,
    description: 'Add a crontab entry (optional)',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface ICrontab {
  crontab?: boolean;
}

// -- version
export const versionOptions = {
  version: option({
    defaultValue: 'latest',
    description: 'Version number to download, eg v2.0.0 (optional)',
    nullable: true,
    typeName: 'string',
  }),
};

export interface IVersion {
  version?: string;
}
