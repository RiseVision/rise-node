// tslint:disable-next-line
export type BlocksConstantsType = {
  blocks: {
    targetTime: number;
    receiptTimeOut: number;
    slotWindow: number;
    maxAmount: number;
    maxPayloadLength: number;
    maxTxsPerBlock: number;
    rewards: Array<{ fromHeight: number; reward: string }>;
  };
};
