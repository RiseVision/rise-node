export interface IMultisignaturesModule {
  /**
   * Gets the tx from the txID, verifies the given signature and
   * @param {{signature: any; transaction: string}} tx
   * @return {Promise<void>}
   */
  processSignature(tx: { signature: any, transaction: string }): Promise<void>;
}
