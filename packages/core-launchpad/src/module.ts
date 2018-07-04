import {CommanderStatic} from 'commander';
import { WordPressHookSystem } from 'mangiafuoco';

export interface ICoreModule {
  configSchema?: any;
  constants?: any;
  version?: string;
  name?: string;
  directory?: string;

  extendCommander(program: CommanderStatic): void;

  setup(hookSystem: WordPressHookSystem): Promise<void>;

  teardown(): Promise<void>;
}

export abstract class BaseModule implements ICoreModule {
  public extendCommander() {
    return void 0;
  }

  public setup(hookSystem: WordPressHookSystem): Promise<void> {
    return Promise.resolve();
  }

  public teardown(): Promise<void> {
    return Promise.resolve();
  }
}
