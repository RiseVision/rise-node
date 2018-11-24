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
  senderPublicKey: string;
  requesterPublicKey?: string;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: string;
  id: string;
  fee: string | number;
  signatures?: string[];
  signSignature?: string;
}

export interface IBaseTransaction<T> {
  type: TransactionType;
  amount: number | string | bigint;
  senderId?: string;
  senderPublicKey: Buffer;
  requesterPublicKey?: Buffer;
  timestamp: number;
  asset?: T;
  recipientId: string;
  signature: Buffer;
  id: string;
  fee: number | string | bigint;
  blockId?: string;
  signatures?: Buffer[];
  signSignature?: Buffer;
}

export interface IConfirmedTransaction<T> extends IBaseTransaction<T> {
  blockId: string;
  height?: number;
  senderId: string;
  recipientPublicKey?: string;
  confirmations?: number;
}

export interface IBytesTransaction {
  bytes: Buffer;
  hasRequesterPublicKey: boolean;
  hasSignSignature: boolean;
  fee: number;
  relays?: number;
  signatures?: Buffer[];
}
