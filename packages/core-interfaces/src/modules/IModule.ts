export interface IModule {
  cleanup(): Promise<void>;
}
