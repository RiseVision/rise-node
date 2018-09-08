import { IBlockLogic, ITransactionLogic } from '../../src/ioc/interfaces/logic';
import { Symbols } from '../../src/ioc/symbols';
import { IBytesBlock, SignedBlockType } from '../../src/logic';
import { IBaseTransaction, IBytesTransaction } from '../../src/logic/transactions';
import initializer from '../integration/common/init';
import { createFakeBlock } from '../utils/blockCrafter';
import { createRandomTransactions, toBufferedTransaction } from '../utils/txCrafter';
import { reportedIT, SimpleMicroSecondTimer } from './benchutils';
import { constants } from '../../src/helpers';

describe('FromBytes benchmark', function() {
  initializer.setup();
  this.timeout(1000000);
  let txLogic: ITransactionLogic;
  let blockLogic: IBlockLogic;

  before(() => {
    txLogic = initializer.appManager.container.get(Symbols.logic.transaction);
    blockLogic = initializer.appManager.container.get(Symbols.logic.block);
  });

  function getTxBytes(transactions) {
    return transactions
      .map((tx) => toBufferedTransaction(tx))
      .map((tx) => generateBytesTransaction(tx));
  }

  function getBlockBytes(blocks) {
    return blocks
      .map((b) => generateBytesBlock(b));
  }

  function generateBytesTransaction(tx: IBaseTransaction<any>): IBytesTransaction {
    return {
      bytes                : txLogic.getBytes(tx),
      fee                  : tx.fee,
      hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
      hasSignSignature     : typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
    };
  }

  function generateBytesBlock(block: SignedBlockType & { relays?: number}): IBytesBlock {
    return {
      bytes       : blockLogic.getBytes(block),
      height      : block.height,
      relays      : Number.isInteger(block.relays) ? block.relays : 1,
      transactions: (block.transactions || []).map((tx) => generateBytesTransaction(tx)),
    };
  }

  describe('TransactionLogic.fromBytes', () => {
    const flavors = [10000];
    reportedIT('vote', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTX = createRandomTransactions({
        vote: 1,
      })[0];
      const bytesTxs = getTxBytes(new Array(txNum).fill(sameTX));
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('delegate', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTX = createRandomTransactions({
        delegate: 1,
      })[0];
      const bytesTxs = getTxBytes(new Array(txNum).fill(sameTX));
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('signature', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTX = createRandomTransactions({
        signature: 1,
      })[0];
      const bytesTxs = getTxBytes(new Array(txNum).fill(sameTX));
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('send', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTX = createRandomTransactions({
        send: 1,
      })[0];
      const bytesTxs = getTxBytes(new Array(txNum).fill(sameTX));
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });
  });

  describe('BlockLogic.fromBytes', () => {
    const flavors = [5000];
    reportedIT('empty', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameBlock = createFakeBlock({
        transactions: [],
      });
      const bytesBlocks = getBlockBytes(new Array(txNum).fill(sameBlock));
      timer.start();
      const realBlocks = bytesBlocks.map((tx) => blockLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('with 10 txs', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTx = createRandomTransactions({
        send: 1,
      })[0];
      const sameBlock = createFakeBlock({
        transactions: new Array(10).fill(sameTx),
      });
      const bytesBlocks = getBlockBytes(new Array(txNum).fill(sameBlock));
      timer.start();
      const realBlocks = bytesBlocks.map((tx) => blockLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('with 25 txs', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const sameTx = createRandomTransactions({
        send: 1,
      })[0];
      const sameBlock = createFakeBlock({
        transactions: new Array(25).fill(sameTx),
      });
      const bytesBlocks = getBlockBytes(new Array(txNum).fill(sameBlock));
      timer.start();
      const realBlocks = bytesBlocks.map((tx) => blockLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('Milliseconds to decode payload sized in kB', [512, 1024, 1536, 2048], async (kiloBytes: number) => {
      const maxBytes = kiloBytes * 1024;
      const timer = new SimpleMicroSecondTimer();
      const numBlocks = Math.ceil(
        (maxBytes * constants.maxTxsPerBlock ) /
        ( txLogic.getMinBytesSize() * constants.maxTxsPerBlock + blockLogic.getMinBytesSize())
        / constants.maxTxsPerBlock );

      console.log(`In ${kiloBytes} kB payload: ${numBlocks} full blocks.`);

      const sameTx = createRandomTransactions({
        send: 1,
      })[0];

      const sameBlock = createFakeBlock({
        transactions: new Array(25).fill(sameTx),
      });

      const bytesBlocks = getBlockBytes(new Array(numBlocks).fill(sameBlock));
      timer.start();
      const realBlocks = bytesBlocks.map((tx) => blockLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / 1000);
    });
  });

});