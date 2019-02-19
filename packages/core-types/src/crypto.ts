import { As } from 'type-tagger';

export interface IKeypair {
  publicKey: Buffer & As<'publicKey'>;
  privateKey: Buffer & As<'privateKey'>;
}
