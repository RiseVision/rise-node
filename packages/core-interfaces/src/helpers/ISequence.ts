/**
 * Object that runs tasks sequentially.
 */
export interface ISequence {
  count(): number;
  addAndPromise<T>(worker: () => Promise<T>): Promise<T>;
}
