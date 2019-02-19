import { As } from 'type-tagger';
export type publicKey = string;

export type Address = string & As<'address'>;
