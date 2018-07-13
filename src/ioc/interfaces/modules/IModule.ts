/**
 * Methods signature for modules
 */
export interface IModule {

  /**
   * Cleanup tasks
   */
  cleanup(): Promise<void>;
}
