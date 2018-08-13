export interface ICoreModuleWithModels {
  /**
   * Called before core-models initializes the models
   */
  onPreInitModels(): void;
}
