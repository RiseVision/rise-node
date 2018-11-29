import {
  IBaseTransaction,
  IBytesTransaction,
  ITransportTransaction,
} from './transactions';

// tslint:disable-next-line
export type BlockType<T = Buffer, N = bigint> = {
  height?: number;
  version: number;
  totalAmount: N;
  totalFee: N;
  reward: N;
  payloadHash: T;
  timestamp: number;
  numberOfTransactions: number;
  payloadLength: number;
  previousBlock: string;
  generatorPublicKey: T;
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

export type SignedAndChainedTransportBlockType = SignedBlockType<
  string,
  string
> & {
  height: number;
  transactions?: Array<ITransportTransaction<any>>;
};

export interface IBytesBlock {
  bytes: Buffer;
  transactions: Buffer[];
  height?: number;
  relays: number;
}
