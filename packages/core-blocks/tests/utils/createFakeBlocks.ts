import * as crypto from 'crypto';
import { Container } from 'inversify';
import * as uuid from 'uuid';
import { IBaseTransaction, IKeypair, SignedAndChainedBlockType, SignedBlockType } from '../../../core-types/src';
import { BlockLogic } from '../../src/logic';
import { BlocksSymbols } from '../../src/blocksSymbols';
import { ICrypto } from '../../../core-interfaces/src/helpers';
import { Symbols } from '../../../core-interfaces/src';

/**
 * Creates a fake "but valid" block
 */
export const createFakeBlock = (container: Container, cfg: {
  timestamp?: number,
  keypair?: IKeypair,
  transactions?: Array<IBaseTransaction<any>>,
  previousBlock?: SignedAndChainedBlockType
} = {}): SignedAndChainedBlockType => {
  const blockLogic: BlockLogic = container.get(BlocksSymbols.logic.block);
  const ed: ICrypto            = container.get(Symbols.generic.crypto);
  const keypair                = cfg.keypair || ed.makeKeyPair(crypto
    .createHash('sha256').update(uuid.v4(), 'utf8')
    .digest());
  const timestamp              = cfg.timestamp || 0;
  const transactions           = cfg.transactions || [];
  const previousBlock: any     = cfg.previousBlock || { id: '1', height: 1 };
  return blockLogic.create({
    keypair,
    previousBlock,
    timestamp,
    transactions,
  });
};
