export interface ICoreModuleWithModels {
  /**
   * Called before core-models initializes the models
   */
  onPreInitModels?(): void | Promise<void>;

  /**
   * Called immediately after core models initalizes the models.
   */
  onPostInitModels?(): void | Promise<void>;
}
