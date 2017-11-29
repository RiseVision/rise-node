/**
 * REmove this useless module
 */
export class ServerModule {
  private loaded: boolean = false;
  private modules: boolean = false;

  public onBlockchainReady() {
    this.loaded = true;
  }

  public cleanup() {
    this.loaded = false;
    return Promise.resolve();
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * TODO: REMOVE ME
   */
  public onBind(scope) {
    this.modules = true;
  }

  /**
   * Returns true if modules are loaded.
   * @return {boolean} modules loaded
   */
  public areModulesReady() {
    return this.modules;
  }

}