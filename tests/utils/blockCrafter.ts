import * as crypto from 'crypto';
import * as uuid from 'uuid';
import { Ed, IKeypair } from '../../src/helpers';
import { IBlockLogic } from '../../src/ioc/interfaces/logic';
import { Symbols } from '../../src/ioc/symbols';
import {
  BlockLogic,
  BlockRewardLogic,
  SignedAndChainedBlockType,
  SignedBlockType,
  TransactionLogic
} from '../../src/logic';
import {
  IBaseTransaction,
  RegisterDelegateTransaction, SecondSignatureTransaction,
  SendTransaction,
  VoteTransaction
} from '../../src/logic/transactions';
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

export const getFakePrevBlock = () => {
  return {
    id                    : '1',
    height                : 100,
    totalAmount           : 0,
    totalFee              : 0,
    version               : 0,
    reward                : 0,
    payloadHash           : Buffer.alloc(0),
    payloadLength         : 0,
    blockSignature        : Buffer.alloc(0),
    previousBlock         : '1',
    numberOfTransactions  : 0,
    timestamp             : 0,
    transactions          : [],
    generatorPublicKey    : Buffer.alloc(0),
  }
}
/**
 * Creates a fake "but valid" block
 */
export const createFakeBlock = (cfg: {
  timestamp?: number,
  keypair?: IKeypair,
  transactions?: Array<IBaseTransaction<any>>,
  previousBlock?: SignedAndChainedBlockType
} = {}): SignedAndChainedBlockType => {
  const blockLogic: IBlockLogic = fakeContainer.get(Symbols.logic.block);
  const ed: Ed                  = fakeContainer.get(Symbols.helpers.ed);
  const keypair                 = cfg.keypair || ed.makeKeypair(crypto
    .createHash('sha256').update(uuid.v4(), 'utf8')
    .digest());
  const timestamp               = cfg.timestamp || 0;
  const transactions            = cfg.transactions || [];
  const previousBlock: any = {
    ... getFakePrevBlock(),
    ...(cfg.previousBlock || {})
  };

  return blockLogic.create({
    keypair,
    previousBlock,
    timestamp,
    transactions,
  });
};
