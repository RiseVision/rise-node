export enum ForkType {
  /**
   * Type 1 happens when a valid block comes but its on a different chain
   */
  TYPE_1 = 1,
  TX_ALREADY_CONFIRMED = 2,
  WRONG_FORGE_SLOT = 3,
  /**
   * Same height and prev id but different block id
   */
  TYPE_5 = 5,
}
