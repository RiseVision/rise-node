import { IBaseTransaction, IConfirmedTransaction, ITransportTransaction } from './transactions';

// tslint:disable-next-line
export type BlockType<T = Buffer> = {
  height?: number;
  version: number;
  totalAmount: number;
  totalFee: number;
  reward: number;
  payloadHash: T;
  timestamp: number;
  numberOfTransactions: number;
  payloadLength: number;
  previousBlock: string;
  generatorPublicKey: T;
  transactions?: Array<IBaseTransaction<any>>;
};

export type SignedBlockType<T = Buffer> = BlockType<T> & {
  id: string;
  blockSignature: T;
  transactions?: Array<IConfirmedTransaction<any>>;
};

export type SignedAndChainedBlockType = SignedBlockType<Buffer> & {
  height: number
};

export type SignedAndChainedTransportBlockType = SignedBlockType<string> & {
  height: number;
  transactions?: Array<ITransportTransaction<any>>
};
