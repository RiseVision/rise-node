import { Address } from './sanityTypes';

export enum TransactionType {
  SEND = 0,
  SIGNATURE = 1,
  DELEGATE = 2,
  VOTE = 3,
  MULTI = 4,
  // DAPP         = 5,
  // IN_TRANSFER  = 6,
  // OUT_TRANSFER = 7,
}

export interface ITransportTransaction<T> {
  type: TransactionType;
  amount: string | number;
  senderId?: string;
  senderPubData: string;
  timestamp: number;
  asset?: T;
  recipientId: string;
  id: string;
  fee: string | number;
  signatures: string[];
  version?: number;
}

export interface IBaseTransaction<T, amountType = bigint> {
  type: TransactionType;
  version: number;
  amount: amountType;
  senderId?: Address;
  senderPubData: Buffer;
  timestamp: number;
  asset?: T;
  recipientId: Address;
  id: string;
  fee: amountType;
  blockId?: string;
  signatures: Buffer[];
}
