/**
 * Methods signature for MultisignaturesModule
 */
export interface IMultisignaturesModule {

  /**
   * Gets the tx from the txID, verifies the given signature and transaction
   */
  processSignature(tx: { signature: any, transaction: string }): Promise<void>;
}
