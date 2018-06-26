import { IModule } from './IModule';

export interface ICacheModule extends IModule {
  readonly isConnected: boolean;

  assertConnected(): Promise<void>;

  assertConnectedAndReady(): Promise<void>;

  getObjFromKey<T>(k: string): Promise<T>;

  setObjFromKey<T>(k: string, value: any): Promise<void>;

  deleteJsonForKey(k: string | string[]): Promise<void>;

  removeByPattern(pattern: string): Promise<void>;

  flushDb(): Promise<void>;

  quit(): Promise<void>;

}
