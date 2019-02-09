// tslint:disable-next-line
export type BlocksConstantsType = {
  /**
   * Target time in seconds for the blocks to be mined
   */
  targetTime: number;
  /**
   * Timeout in seconds till we can consider being in a stale situation where a resync could happen
   */
  receiptTimeOut: number;
  /**
   * Window of blocks of which a slot could be accepted
   */
  slotWindow: number;
  /**
   * Max amount of bytes in block payload
   */
  maxPayloadLength: number;
  /**
   * Max number of transactions per block
   */
  maxTxsPerBlock: number;
  /**
   * Rewards schedule
   */
  rewards: Array<{ fromHeight: number; reward: string }>;
  /**
   * Valid versions number
   */
  validVersions: number[];
};

export const constants: BlocksConstantsType = {
  maxPayloadLength: 1024 * 1024,
  maxTxsPerBlock: 25,
  receiptTimeOut: 30 + 15, // 1.5 blocks
  rewards: [
    {
      fromHeight: 0,
      reward: '0',
    },
  ],
  slotWindow: 5,
  targetTime: 30,
  validVersions: [0],
};
