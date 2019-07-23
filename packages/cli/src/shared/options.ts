import { option } from '@carnesen/cli';
import { NETWORKS, TNetworkType } from './misc';

export const configOption = {
  config: option({
    description: 'Path to the config file',
    nullable: true,
    typeName: 'string',
  }),
};

export interface IConfig {
  config: string;
}

export const networkOption = {
  network: option({
    allowedValues: NETWORKS,
    defaultValue: 'mainnet',
    nullable: true,
    typeName: 'string',
  }),
};

export interface INetwork {
  network: TNetworkType;
}

export const verboseOption = {
  verbose: option({
    defaultValue: false,
    description: 'Show as much information as possible',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IVerbose {
  verbose: boolean;
}

export const foregroundOption = {
  foreground: option({
    defaultValue: false,
    description: 'Keep the process in the foreground and stream the output',
    nullable: true,
    typeName: 'boolean',
  }),
};

export interface IForeground {
  foreground: boolean;
}
