import { Symbols } from '@risevision/core-helpers';
import * as crypto from 'crypto';
import * as uuid from 'uuid';


import { createContainer } from './containerCreator';

const fakeContainer = createContainer();
fakeContainer.rebind(Symbols.helpers.ed).toConstantValue(new Ed());
fakeContainer.rebind(Symbols.logic.blockReward).to(BlockRewardLogic).inSingletonScope();
fakeContainer.rebind(Symbols.logic.block).to(BlockLogic).inSingletonScope();
fakeContainer.rebind(Symbols.logic.transaction).to(TransactionLogic).inSingletonScope();

const txLogic: TransactionLogic = fakeContainer.get(Symbols.logic.transaction);
txLogic.attachAssetType(fakeContainer.get(Symbols.logic.transactions.send));
txLogic.attachAssetType(fakeContainer.get(Symbols.logic.transactions.vote));
txLogic.attachAssetType(fakeContainer.get(Symbols.logic.transactions.secondSignature));
txLogic.attachAssetType(fakeContainer.get(Symbols.logic.transactions.delegate));
/**
 * Creates a fake "but valid" block
 */
export const createFakeBlock = (cfg: {
  timestamp?: number,
  keypair?: IKeypair,
  transactions?: Array<IBaseTransaction<any>>,
  previousBlock?: SignedAndChainedBlockType
} = {}): SignedBlockType => {
  const blockLogic: IBlockLogic = fakeContainer.get(Symbols.logic.block);
  const ed: Ed                  = fakeContainer.get(Symbols.helpers.ed);
  const keypair                 = cfg.keypair || ed.makeKeypair(crypto
    .createHash('sha256').update(uuid.v4(), 'utf8')
    .digest());
  const timestamp               = cfg.timestamp || 0;
  const transactions            = cfg.transactions || [];
  const previousBlock: any      = cfg.previousBlock || { id: '1', height: 1 };
  return blockLogic.create({
    keypair,
    previousBlock,
    timestamp,
    transactions,
  });
};
