import { IBaseTransaction, ITransportTransaction } from './transactions';

// tslint:disable-next-line
export type BlockHeader<T = Buffer, N = bigint> = {
  version: number;
  timestamp: number;
  previousBlock: string | null;
  numberOfTransactions: number;
  totalAmount: N;
  totalFee: N;
  reward: N;
  payloadLength: number;
  payloadHash: T;
  generatorPublicKey: T;
  blockSignature?: T;
};

// tslint:disable-next-line
export type BlockType<T = Buffer, N = bigint> = BlockHeader<T, N> & {
  height?: number;
  transactions?: Array<IBaseTransaction<any, N>>;
};

export type SignedBlockType<T = Buffer, N = bigint> = BlockType<T, N> & {
  id: string;
  blockSignature: T;
  transactions?: Array<IBaseTransaction<any, N>>;
};

export type SignedAndChainedBlockType = SignedBlockType<Buffer> & {
  height: number;
};
