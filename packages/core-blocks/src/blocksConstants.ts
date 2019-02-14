// tslint:disable-next-line
export type BlocksConstantsType = {
  /**
   * Target time in seconds for the blocks to be mined
   */
  targetTime: number;
  /**
   * Window of blocks of which a slot could be accepted
   */
  slotWindow: number;
  /**
   * Block age in seconds after which the state of the node gets labelled as stale for the resync
   */
  staleAgeThreshold: number;
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
  rewards: [
    {
      fromHeight: 0,
      reward: '0',
    },
  ],
  slotWindow: 5,
  staleAgeThreshold: 30 + 15, // 1.5 blocks
  targetTime: 30,
  validVersions: [0],
};
