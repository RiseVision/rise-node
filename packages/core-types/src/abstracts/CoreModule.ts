import { CommanderStatic } from 'commander';
import { Container } from 'inversify';

import { ICoreModule } from '../interfaces';

export abstract class BaseCoreModule<ConfigType = any>
  implements ICoreModule<ConfigType> {
  public abstract configSchema: any;
  public abstract constants: any;
  public version = null;
  public name = null;
  public directory = null;
  public container?: Container;
  public config?: ConfigType;
  public sortedModules?: Array<ICoreModule<ConfigType>>;

  public extendCommander(program: CommanderStatic): void {
    return void 0;
  }

  public patchConfigWithCLIParams<T extends ConfigType>(
    program: CommanderStatic,
    config: T
  ): T {
    return config;
  }

  public preBoot(): Promise<void> {
    return Promise.resolve();
  }

  public boot(): Promise<void> {
    return Promise.resolve();
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }

  public postTeardown(): Promise<void> {
    return Promise.resolve();
  }

  public afterConfigValidation<T extends ConfigType>(config: T): T {
    return config;
  }

  public addElementsToContainer() {
    return void 0;
  }

  public initAppElements(): Promise<void> | void {
    return null;
  }
}
