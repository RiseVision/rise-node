import { CommanderStatic } from 'commander';
import { Container } from 'inversify';

export interface ICoreModule<ConfigType> {
  configSchema: any;
  constants: any;
  version: string;
  name: string;
  directory: string;
  container?: Container;
  config?: ConfigType;
  sortedModules?: Array<ICoreModule<any>>;

  extendCommander(program: CommanderStatic): void;

  afterConfigValidation?<T extends ConfigType>(config: T): T;

  patchConfigWithCLIParams?<T extends ConfigType>(
    progrma: CommanderStatic,
    config: T
  ): T;

  addElementsToContainer(): void;

  preBoot(): Promise<void>;

  initAppElements(): void | Promise<void>;

  boot(): Promise<void>;

  teardown(): Promise<void>;

  postTeardown(): Promise<void>;
}
