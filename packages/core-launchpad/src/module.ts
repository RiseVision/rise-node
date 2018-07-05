import { CommanderStatic } from 'commander';
import { WordPressHookSystem } from 'mangiafuoco';

export interface ICoreModule {
  configSchema: any;
  constants: any;
  version: string;
  name: string;
  directory: string;

  extendCommander(program: CommanderStatic): void;

  setup(hookSystem: WordPressHookSystem): Promise<void>;

  teardown(): Promise<void>;

  afterConfigValidation?<T>(config: T): T;
}

export abstract class BaseCoreModule implements ICoreModule {
  public abstract configSchema: any;
  public abstract constants: any;
  public version = null;
  public name = null;
  public directory = null;

  public extendCommander(program: CommanderStatic): void {
    return void 0;
  }

  public setup(hookSystem: WordPressHookSystem): Promise<void> {
    return Promise.resolve();
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }

  public afterConfigValidation<T>(config: T): T {
    return config;
  }
}
